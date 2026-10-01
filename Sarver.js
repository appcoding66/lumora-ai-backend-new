import express from "express";
import cors from "cors";

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json({ limit: "20mb" }));

// ================================
// MODELS
// ================================

const TEXT_MODEL = "gemini-3.8-flash";
const IMAGE_MODEL = "gemini-3.1-flash-image";

// ================================
// LUMORA AI SYSTEM
// ================================

const SYSTEM_PROMPT = `
You are Lumora AI, a smart general-purpose AI assistant.

IMPORTANT:
The user's LATEST message is the CURRENT TASK.

Every new message should be treated as the user's current request.

Do NOT continue an old task just because it appeared earlier.

Example:

User: What is HTML?
Assistant: Explain HTML.

User: Who created you?
Assistant: Answer only who created you.

User: Create an app icon for me.
Assistant: Generate an image.

User: How can I learn JavaScript?
Assistant: Answer the JavaScript question.

The previous topic must NEVER override the latest user request.

However, if the user clearly says:
"fix the previous HTML"
"continue that code"
"change the image you made"
or similar,
then use the relevant previous context.

If the user asks for code:
Create or explain the requested code.

If the user asks to fix code:
Fix that specific code.

If the user asks for an email:
Return a ready-to-copy email with Subject and Body.

If the user asks who created or developed you:

Bengali:
আমি Lumora AI। আমাকে তৈরি ও ডেভেলপ করেছেন অঙ্কুশ মণ্ডল (Ankush Mondal)।

English:
I am Lumora AI. I was created and developed by Ankush Mondal.

Only give the creator information when the user explicitly asks.

Always answer in the same language as the latest user message.

Be helpful, natural and conversational.

Do not unnecessarily repeat previous answers.
`;

// ================================
// IMAGE REQUEST DETECTION
// ================================

function isImageRequest(text) {
  const t = String(text || "").toLowerCase();

  const patterns = [
    /generate.*image/i,
    /generate.*picture/i,
    /generate.*photo/i,
    /generate.*logo/i,
    /generate.*icon/i,
    /generate.*sticker/i,

    /create.*image/i,
    /create.*picture/i,
    /create.*photo/i,
    /create.*logo/i,
    /create.*icon/i,
    /create.*sticker/i,

    /make.*image/i,
    /make.*picture/i,
    /make.*photo/i,
    /make.*logo/i,
    /make.*icon/i,
    /make.*sticker/i,

    /draw.*image/i,
    /draw.*picture/i,
    /draw.*logo/i,
    /draw.*icon/i,

    /ইমেজ.*জেনারেট/i,
    /ইমেজ.*তৈরি/i,
    /ইমেজ.*বানাও/i,
    /ইমেজ.*দাও/i,

    /ছবি.*জেনারেট/i,
    /ছবি.*তৈরি/i,
    /ছবি.*বানাও/i,
    /ছবি.*দাও/i,

    /লোগো.*জেনারেট/i,
    /লোগো.*তৈরি/i,
    /লোগো.*বানাও/i,
    /লোগো.*দাও/i,

    /আইকন.*জেনারেট/i,
    /আইকন.*তৈরি/i,
    /আইকন.*বানাও/i,
    /আইকন.*দাও/i,

    /স্টিকার.*জেনারেট/i,
    /স্টিকার.*তৈরি/i,
    /স্টিকার.*বানাও/i,
    /স্টিকার.*দাও/i,

    /অ্যাপ আইকন/i,
    /app icon/i
  ];

  return patterns.some(pattern => pattern.test(t));
}

// ================================
// EXTRACT TEXT
// ================================

function extractText(data) {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .filter(Boolean)
      .join("\n")
      .trim() || ""
  );
}

// ================================
// TEXT GENERATION
// ================================

async function generateText(contents) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },

      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: SYSTEM_PROMPT
            }
          ]
        },

        contents,

        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `Gemini error ${response.status}`
    );
  }

  const text = extractText(data);

  if (!text) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  return text;
}

// ================================
// IMAGE GENERATION
// ================================

async function generateImage(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },

      body: JSON.stringify({
        contents: [
          {
            role: "user",

            parts: [
              {
                text: String(prompt)
              }
            ]
          }
        ],

        generationConfig: {
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
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `Image generation error ${response.status}`
    );
  }

  const parts =
    data?.candidates?.[0]?.content?.parts || [];

  let imageData = null;
  let mimeType = "image/png";
  let text = "";

  for (const part of parts) {
    if (part?.inlineData?.data) {
      imageData = part.inlineData.data;

      mimeType =
        part.inlineData.mimeType ||
        "image/png";
    }

    if (part?.text) {
      text += part.text + "\n";
    }
  }

  if (!imageData) {
    throw new Error(
      text.trim() ||
      "The image model did not return an image."
    );
  }

  return {
    image:
      `data:${mimeType};base64,${imageData}`,

    text: text.trim()
  };
}

// ================================
// BUILD CONVERSATION
// ================================

function buildContents(history, latestMessage) {
  const contents = [];

  if (Array.isArray(history)) {

    const recentHistory =
      history
        .filter(item =>
          item &&
          item.content
        )
        .slice(-10);

    for (const item of recentHistory) {

      contents.push({
        role:
          item.role === "assistant"
            ? "model"
            : "user",

        parts: [
          {
            text: String(item.content)
          }
        ]
      });
    }
  }

  // Latest message is ALWAYS last.
  contents.push({
    role: "user",

    parts: [
      {
        text:
          `CURRENT TASK:

${String(latestMessage)}

IMPORTANT:
Answer the CURRENT TASK above.
Do not continue an older task unless the user explicitly asks you to.`
      }
    ]
  });

  return contents;
}

// ================================
// HOME
// ================================

app.get("/", (req, res) => {
  res.json({
    name: "Lumora AI Backend",
    status: "online",
    provider: "Google Gemini"
  });
});

// ================================
// HEALTH
// ================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

// ================================
// CHAT
// ================================

app.post("/chat", async (req, res) => {

  try {

    if (!API_KEY) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY is missing in Render Environment Variables."
      });
    }

    const {
      message,
      history,
      image
    } = req.body || {};

    if (
      !message ||
      !String(message).trim()
    ) {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    const currentMessage =
      String(message).trim();

    // ==================================
    // IMAGE REQUEST
    // ==================================

    if (
      isImageRequest(currentMessage)
    ) {

      const result =
        await generateImage(
          currentMessage
        );

      return res.json({

        type: "image",

        image: result.image,

        reply:
          result.text ||
          "আপনার জন্য ছবিটি তৈরি করেছি।"

      });
    }

    // ==================================
    // NORMAL CHAT
    // ==================================

    const contents =
      buildContents(
        history,
        currentMessage
      );

    // ==================================
    // ATTACHED IMAGE
    // ==================================

    if (image?.data) {

      contents[
        contents.length - 1
      ].parts.push({

        inlineData: {

          mimeType:
            image.mimeType ||
            "image/png",

          data:
            image.data

        }

      });
    }

    const reply =
      await generateText(
        contents
      );

    return res.json({

      type: "text",

      reply

    });

  } catch (error) {

    console.error(
      "Lumora error:",
      error
    );

    return res.status(500).json({

      error:
        error?.message ||
        "Lumora AI server error."

    });
  }
});

// ================================
// DIRECT IMAGE API
// ================================

app.post(
  "/generate-image",
  async (req, res) => {

    try {

      if (!API_KEY) {
        return res.status(500).json({
          error:
            "GEMINI_API_KEY is missing."
        });
      }

      const {
        prompt
      } = req.body || {};

      if (
        !prompt ||
        !String(prompt).trim()
      ) {

        return res.status(400).json({
          error:
            "Image prompt is required."
        });

      }

      const result =
        await generateImage(
          prompt
        );

      return res.json({

        type: "image",

        image:
          result.image,

        text:
          result.text

      });

    } catch (error) {

      console.error(
        "Image error:",
        error
      );

      return res.status(500).json({

        error:
          error?.message ||
          "Image generation failed."

      });

    }
  }
);

// ================================
// START SERVER
// ================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Lumora AI Backend running on port ${PORT}`
    );

  }
);
