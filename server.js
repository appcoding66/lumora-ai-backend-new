import express from "express";
import cors from "cors";

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// ===============================
// GEMINI MODELS
// ===============================

const TEXT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite"
];

const IMAGE_MODEL = "gemini-3.1-flash-image";

// ===============================
// LUMORA AI SYSTEM INSTRUCTION
// ===============================

const SYSTEM = `
You are Lumora AI, a general-purpose AI assistant.

IMPORTANT TASK RULE:
The LATEST user message is ALWAYS the CURRENT TASK.
Older messages are context only.

If the user changes the topic, immediately switch to the new topic.
Never continue an old task unless the latest message clearly refers to it.

Examples:
- User asks "What is HTML?" -> explain HTML.
- Then user asks "Who created you?" -> answer only the creator question.
- Then user asks "Make HTML for me." -> create the requested HTML.
- Then user says "There is an error in the HTML, fix it." -> fix that HTML.

If the user asks to explain something:
Explain only that subject.

If the user asks to create, write, modify, or fix HTML/code:
Work directly on that exact request.

If the user asks for an email:
Create a ready-to-copy email with:
Subject:
Body:

If the user asks about current websites, links, YouTube videos,
latest information, news, or web information:
Use Google Search grounding when available.

If the user attaches an image or screenshot:
Inspect the image and answer based on it.

Always reply in the same language as the latest user message.

CREATOR INFORMATION:
Only when the user explicitly asks who created, made, or developed you:

Bengali:
"আমি Lumora AI। আমাকে তৈরি ও ডেভেলপ করেছেন অঙ্কুশ মণ্ডল (Ankush Mondal)।"

English:
"I am Lumora AI. I was created and developed by Ankush Mondal."

Do NOT mention the creator unless the user explicitly asks.
`;

// ===============================
// BUILD CONVERSATION
// ===============================

function buildContents(history, message, image) {
  const contents = [];

  if (Array.isArray(history)) {
    for (const item of history.slice(-16)) {
      if (!item || !item.content) continue;

      contents.push({
        role: item.role === "assistant" ? "model" : "user",
        parts: [
          {
            text: String(item.content)
          }
        ]
      });
    }
  }

  const parts = [
    {
      text: "CURRENT TASK:\n" + String(message)
    }
  ];

  if (image && image.data) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType || "image/png",
        data: image.data
      }
    });
  }

  contents.push({
    role: "user",
    parts
  });

  return contents;
}

// ===============================
// GEMINI REQUEST
// ===============================

async function callGemini(model, body, version = "v1beta") {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message || `Gemini error ${response.status}`
    );
  }

  return data;
}

// ===============================
// EXTRACT TEXT
// ===============================

function extractText(data) {
  return (data?.candidates || [])
    .flatMap(candidate => candidate?.content?.parts || [])
    .map(part => part?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

// ===============================
// SEARCH DETECTION
// ===============================

function needsSearch(text) {
  return /search|latest|today|current|news|website|web|link|url|youtube|find|সার্চ|ওয়েবসাইট|লিংক|ইউটিউব|খুঁজে|বর্তমান|আজকের|সর্বশেষ/i.test(
    text || ""
  );
}

// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
  res.json({
    name: "Lumora AI Backend",
    status: "online",
    provider: "Google Gemini"
  });
});

// ===============================
// HEALTH CHECK
// ===============================

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

// ===============================
// CHAT API
// ===============================

app.post("/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured."
      });
    }

    const {
      message,
      history,
      image
    } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    const body = {
      systemInstruction: {
        parts: [
          {
            text: SYSTEM
          }
        ]
      },

      contents: buildContents(
        history,
        message,
        image
      ),

      generationConfig: {
        temperature: 0.7
      }
    };

    // Enable Google Search for current/web-related questions
    if (needsSearch(message)) {
      body.tools = [
        {
          googleSearch: {}
        }
      ];
    }

    let lastError = null;

    for (const model of TEXT_MODELS) {
      try {
        const data = await callGemini(
          model,
          body
        );

        const reply = extractText(data);

        if (reply) {
          return res.json({
            reply,
            model
          });
        }
      } catch (error) {
        lastError = error;
      }
    }

    return res.status(502).json({
      error:
        lastError?.message ||
        "Unable to generate response."
    });

  } catch (error) {
    return res.status(500).json({
      error:
        error?.message ||
        "Server error."
    });
  }
});

// ===============================
// IMAGE GENERATION API
// ===============================

app.post("/generate-image", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured."
      });
    }

    const {
      prompt,
      aspectRatio = "1:1"
    } = req.body || {};

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({
        error: "Image prompt is required."
      });
    }

    const data = await callGemini(
      IMAGE_MODEL,
      {
        contents: [
          {
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
              aspectRatio,
              imageSize: "1K"
            }
          }
        }
      },
      "v1"
    );

    const parts =
      data?.candidates?.flatMap(
        candidate =>
          candidate?.content?.parts || []
      ) || [];

    const imagePart = parts.find(
      part => part?.inlineData?.data
    );

    const text =
      parts
        .map(part => part?.text || "")
        .filter(Boolean)
        .join("\n")
        .trim();

    if (!imagePart) {
      return res.status(502).json({
        error:
          text ||
          "Image was not returned."
      });
    }

    const mimeType =
      imagePart.inlineData.mimeType ||
      "image/png";

    const imageData =
      imagePart.inlineData.data;

    return res.json({
      image:
        `data:${mimeType};base64,${imageData}`,

      text,

      model: IMAGE_MODEL
    });

  } catch (error) {
    return res.status(502).json({
      error:
        error?.message ||
        "Image generation failed."
    });
  }
});

// ===============================
// START SERVER
// ===============================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Lumora AI Backend running on port ${PORT}`
    );
  }
);
