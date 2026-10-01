import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "25mb" }));

const CHAT_MODEL =
  process.env.GEMINI_CHAT_MODEL || "gemini-3.8-flash";

const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

const SYSTEM_INSTRUCTION = `
You are Lumora AI, a general-purpose AI assistant.

Answer the user's latest request clearly and directly.

Important context rule:
Only use previous conversation context when the user explicitly refers to a previous task, previous code, previous answer, or asks to continue/fix something from before.

Examples of explicit references:
- আগের code ঠিক করো
- আগের HTML ঠিক করো
- ওই code continue করো
- fix the code you gave
- continue from before

If the user asks a completely new question without referring to previous work,
answer only the new question.

Match the language used by the user.

If the user asks who created or developed you, say:
"I am Lumora AI. I was created and developed by Ankush Mondal (অঙ্কুশ মণ্ডল)."
`;

function isCreatorQuestion(message = "") {
  const t = String(message).toLowerCase().trim();

  const phrases = [
    "who created you",
    "who made you",
    "who built you",
    "who developed you",
    "who is your creator",
    "who is your developer",
    "who created lumora",
    "who made lumora",

    "কে তোমাকে তৈরি করেছে",
    "কে আপনাকে তৈরি করেছে",
    "তোমাকে কে বানিয়েছে",
    "তোমাকে কে বানিয়েছে",
    "আপনাকে কে বানিয়েছে",
    "আপনাকে কে বানিয়েছে",
    "লুমোরা এআই কে তৈরি করেছে",
    "লুমোরা ai কে তৈরি করেছে",
    "লুমোরা এআই কে বানিয়েছে",
    "লুমোরা এআই কে বানিয়েছে"
  ];

  return phrases.some(x => t.includes(x));
}

function isImageRequest(message = "") {
  const t = String(message).toLowerCase().trim();

  return (
    /(?:create|generate|make|draw|design|render|produce).*(?:image|picture|photo|logo|icon|sticker|poster|wallpaper|illustration)/i.test(t) ||
    /(?:image|picture|photo|logo|icon|sticker|poster|wallpaper|illustration).*(?:create|generate|make|draw|design|render|produce)/i.test(t) ||
    /(?:ইমেজ|ছবি|ফটো|লোগো|আইকন|স্টিকার|পোস্টার|ওয়ালপেপার|ওয়ালপেপার|ইলাস্ট্রেশন).*(?:জেনারেট|তৈরি|বানাও|দাও|করো|করুন)/i.test(t) ||
    /(?:একটা|আমাকে|আমার জন্য).*(?:ইমেজ|ছবি|লোগো|আইকন|স্টিকার|পোস্টার|ওয়ালপেপার|ওয়ালপেপার).*(?:তৈরি|বানাও|দাও|করো|করুন)/i.test(t)
  );
}

function parseDataUrl(value) {
  if (typeof value !== "string") return null;

  const match = value.match(
    /^data:(image\/[A-Za-z0-9.+-]+);base64,([\s\S]+)$/
  );

  if (!match) return null;

  return {
    mimeType: match[1],
    data: match[2]
  };
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-12)
    .filter(
      item =>
        item &&
        (item.role === "user" || item.role === "model")
    )
    .map(item => ({
      role: item.role,
      parts: [
        {
          text: String(item.content || "").slice(0, 14000)
        }
      ]
    }));
}

async function generateText(ai, message, history, image) {
  const contents = cleanHistory(history);

  const parts = [];

  const uploadedImage = parseDataUrl(image);

  if (uploadedImage) {
    parts.push({
      inlineData: {
        mimeType: uploadedImage.mimeType,
        data: uploadedImage.data
      }
    });
  }

  parts.push({
    text: String(message || "")
  });

  contents.push({
    role: "user",
    parts
  });

  const response = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      maxOutputTokens: 8192
    }
  });

  const reply = String(response?.text || "").trim();

  if (!reply) {
    throw new Error("Gemini returned an empty response.");
  }

  return {
    reply,
    model: CHAT_MODEL
  };
}

/*
====================================================
REAL IMAGE GENERATION
Gemini image generation model
====================================================
*/

async function generateImage(ai, prompt, image) {
  const contents = [];

  const uploadedImage = parseDataUrl(image);

  if (uploadedImage) {
    contents.push({
      inlineData: {
        mimeType: uploadedImage.mimeType,
        data: uploadedImage.data
      }
    });
  }

  contents.push({
    text: String(prompt || "Create an image.")
  });

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      responseFormat: {
        image: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    }
  });

  let generatedImage = null;
  let generatedText = "";

  const parts =
    response?.candidates?.[0]?.content?.parts || [];

  for (const part of parts) {
    if (part?.inlineData?.data) {
      generatedImage = {
        data: part.inlineData.data,
        mimeType:
          part.inlineData.mimeType || "image/png"
      };
    }

    if (part?.text) {
      generatedText += part.text;
    }
  }

  if (!generatedImage) {
    throw new Error(
      "Gemini image model returned no image."
    );
  }

  return {
    type: "image",
    image:
      `data:${generatedImage.mimeType};base64,${generatedImage.data}`,
    reply: generatedText.trim(),
    model: IMAGE_MODEL
  };
}

/*
====================================================
BACKEND HOME
====================================================
*/

app.get("/", (req, res) => {
  res.json({
    name: "Lumora AI Backend",
    status: "online",
    version: "image-generation-fixed-1.0",
    chatModel: CHAT_MODEL,
    imageModel: IMAGE_MODEL,
    imageGeneration: true,
    realImageGeneration: true
  });
});

/*
====================================================
HEALTH CHECK
====================================================
*/

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "online",
    imageGeneration: true,
    realImageGeneration: true
  });
});

/*
====================================================
IMAGE GENERATION ENDPOINT
====================================================
*/

app.post("/generate-image", async (req, res) => {
  const prompt = String(
    req.body?.prompt || ""
  ).trim();

  const image = req.body?.image || null;

  if (!prompt) {
    return res.status(400).json({
      error: "Image prompt is required."
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error:
        "GEMINI_API_KEY is not configured on the Render server."
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const result = await generateImage(
      ai,
      prompt,
      image
    );

    return res.json(result);
  } catch (error) {
    console.error(
      "IMAGE GENERATION ERROR:",
      error
    );

    return res.status(503).json({
      error:
        error?.message ||
        "Unable to generate image."
    });
  }
});

/*
====================================================
CHAT ENDPOINT
====================================================
*/

app.post("/chat", async (req, res) => {
  const message = String(
    req.body?.message || ""
  ).trim();

  const history =
    Array.isArray(req.body?.history)
      ? req.body.history
      : [];

  const image =
    req.body?.image || null;

  if (!message && !image) {
    return res.status(400).json({
      error: "Message or image is required."
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error:
        "GEMINI_API_KEY is not configured on the Render server."
    });
  }

  /*
  Creator question
  */

  if (isCreatorQuestion(message)) {
    return res.json({
      reply:
        "I am Lumora AI. I was created and developed by Ankush Mondal (অঙ্কুশ মণ্ডল).",
      model: "creator-response"
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    /*
    Safety fallback:
    If frontend sends an image request to /chat,
    generate a real image instead of returning code.
    */

    if (isImageRequest(message)) {
      const result = await generateImage(
        ai,
        message,
        image
      );

      return res.json(result);
    }

    /*
    Normal AI chat
    */

    const result = await generateText(
      ai,
      message,
      history,
      image
    );

    return res.json(result);

  } catch (error) {
    console.error(
      "CHAT ERROR:",
      error
    );

    return res.status(503).json({
      error:
        error?.message ||
        "Unable to get a response from Gemini."
    });
  }
});

/*
====================================================
START SERVER
====================================================
*/

app.listen(PORT, () => {
  console.log(
    `Lumora AI Backend running on port ${PORT}`
  );

  console.log(
    `Chat model: ${CHAT_MODEL}`
  );

  console.log(
    `Image model: ${IMAGE_MODEL}`
  );
});
