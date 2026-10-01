import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "25mb" }));

const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.8-flash";
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

const CREATOR_BN = "আমি Lumora AI। আমাকে তৈরি ও ডেভেলপ করেছেন অঙ্কুশ মণ্ডল (Ankush Mondal)।";
const CREATOR_EN = "I am Lumora AI. I was created and developed by Ankush Mondal.";

function creatorQuestion(s = "") {
  const t = s.toLowerCase().trim();

  return [
    "who created you",
    "who made you",
    "who built you",
    "who developed you",
    "who is your creator",
    "who is your developer",
    "who created lumora ai",
    "who made lumora ai",
    "কে তোমাকে তৈরি করেছে",
    "কে আপনাকে তৈরি করেছে",
    "তোমাকে কে বানিয়েছে",
    "আপনাকে কে বানিয়েছে",
    "কে তোমাকে বানিয়েছে",
    "কে আপনাকে বানিয়েছে",
    "লুমোরা এআই কে তৈরি করেছে",
    "লুমোরা ai কে তৈরি করেছে",
    "লুমোরা এআই কে বানিয়েছে",
    "লুমোরা এআই কে বানিয়েছে"
  ].some(x => t.includes(x));
}

function mostlyEnglish(s = "") {
  const bn = (s.match(/[\u0980-\u09FF]/g) || []).length;
  const en = (s.match(/[A-Za-z]/g) || []).length;
  return en >= bn;
}

function parseDataUrl(s) {
  if (typeof s !== "string") return null;

  const m = s.match(
    /^data:(image\/[A-Za-z0-9.+-]+);base64,([\s\S]+)$/
  );

  return m
    ? {
        mimeType: m[1],
        data: m[2]
      }
    : null;
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-12)
    .filter(
      x =>
        x &&
        (x.role === "user" || x.role === "model")
    )
    .map(x => ({
      role: x.role,
      parts: [
        {
          text: String(x.content || "").slice(0, 14000)
        }
      ]
    }));
}

function isImageRequest(message = "") {
  const t = String(message).toLowerCase().trim();

  return /(?:create|generate|make|draw|design|render|produce).*(?:image|picture|photo|logo|icon|sticker|poster|wallpaper|illustration)|(?:image|picture|photo|logo|icon|sticker|poster|wallpaper|illustration).*(?:create|generate|make|draw|design|render|produce)|(?:ইমেজ|ছবি|ফটো|লোগো|আইকন|স্টিকার|পোস্টার|ওয়ালপেপার|ওয়ালপেপার|ইলাস্ট্রেশন).*(?:জেনারেট|তৈরি|বানাও|দাও|করো|করুন)|(?:একটা|আমাকে|আমার জন্য).*(?:ইমেজ|ছবি|লোগো|আইকন|স্টিকার|পোস্টার|ওয়ালপেপার|ওয়ালপেপার).*(?:তৈরি|বানাও|দাও|করো|করুন)/i.test(t);
}

function needsWebSearch(message = "") {
  const t = message.toLowerCase();

  return [
    "search",
    "find",
    "website",
    "web site",
    "link",
    "url",
    "latest",
    "today",
    "current",
    "recent",
    "news",
    "live",
    "official website",
    "look up",
    "খুঁজে",
    "ওয়েবসাইট",
    "ওয়েবসাইট",
    "লিংক",
    "লিঙ্ক",
    "সার্চ",
    "বর্তমান",
    "আজকের",
    "সাম্প্রতিক",
    "খবর"
  ].some(x => t.includes(x));
}

const SYSTEM = `
You are Lumora AI, a general-purpose task-execution assistant.

Complete the user's actual task whenever possible.

- Answer normal questions directly.
- If the user asks for code, give complete usable code when enough information exists.
- Match the user's language.
- Never invent links, facts, search results, or completed external actions.
- Do not mention Ankush Mondal unless the user explicitly asks who created, made, built, or developed you.
`;

async function chatText(ai, message, history, image) {
  const contents = cleanHistory(history);
  const parts = [];

  const img = parseDataUrl(image);

  if (img) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data
      }
    });
  }

  parts.push({
    text: String(
      message || "Please analyze the attached image."
    )
  });

  contents.push({
    role: "user",
    parts
  });

  const config = {
    systemInstruction: SYSTEM,
    maxOutputTokens: 8192
  };

  if (needsWebSearch(message)) {
    config.tools = [
      {
        googleSearch: {}
      }
    ];
  }

  const response = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents,
    config
  });

  const text = String(
    response?.text || ""
  ).trim();

  if (!text) {
    throw new Error(
      "Gemini returned no text response."
    );
  }

  return {
    reply: text,
    model: CHAT_MODEL
  };
}

async function makeImage(ai, prompt, image) {
  const contents = [];

  const img = parseDataUrl(image);

  if (img) {
    contents.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data
      }
    });
  }

  contents.push({
    text: String(
      prompt || "Create an image."
    )
  });

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents,
    config: {
      responseModalities: [
        "TEXT",
        "IMAGE"
      ],
      responseFormat: {
        image: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    }
  });

  let imageData = null;
  let text = "";

  for (
    const part of
    response?.candidates?.[0]?.content?.parts || []
  ) {
    if (part?.inlineData?.data) {
      imageData = {
        data: part.inlineData.data,
        mimeType:
          part.inlineData.mimeType ||
          "image/png"
      };
    }

    if (part?.text) {
      text += part.text;
    }
  }

  if (!imageData) {
    throw new Error(
      "Gemini image model returned no image data."
    );
  }

  return {
    type: "image",
    image:
      `data:${imageData.mimeType};base64,${imageData.data}`,
    text: text.trim(),
    model: IMAGE_MODEL
  };
}

app.get("/", (req, res) => {
  res.json({
    name: "Lumora AI Backend",
    status: "online",
    version: "image-generation-fixed-1.0",
    chatModel: CHAT_MODEL,
    imageModel: IMAGE_MODEL,
    imageGeneration: true
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "online",
    imageGeneration: true
  });
});

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

    return res.json(
      await makeImage(ai, prompt, image)
    );
  } catch (error) {
    console.error(
      "/generate-image ERROR:",
      error
    );

    return res.status(503).json({
      error:
        error?.message ||
        "Unable to generate image."
    });
  }
});

app.post("/chat", async (req, res) => {
  const message = String(
    req.body?.message || ""
  ).trim();

  const history =
    req.body?.history || [];

  const image =
    req.body?.image || null;

  if (!message && !image) {
    return res.status(400).json({
      error:
        "Message or image is required."
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error:
        "GEMINI_API_KEY is not configured on the Render server."
    });
  }

  if (creatorQuestion(message)) {
    return res.json({
      reply: mostlyEnglish(message)
        ? CREATOR_EN
        : CREATOR_BN,
      model: "creator-response"
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    // Safety net:
    // If an older frontend sends an image request
    // to /chat, use the real image model.
    if (isImageRequest(message)) {
      return res.json(
        await makeImage(
          ai,
          message,
          image
        )
      );
    }

    return res.json(
      await chatText(
        ai,
        message,
        history,
        image
      )
    );
  } catch (error) {
    console.error(
      "/chat ERROR:",
      error
    );

    return res.status(503).json({
      error:
        error?.message ||
        "Unable to get a response from Gemini."
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `Lumora AI Backend running on port ${PORT}`
  );
});
