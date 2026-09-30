import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "30mb" }));

// ================================
// GEMINI MODELS
// ================================

const CHAT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite"
];

// ================================
// LUMORA SYSTEM PROMPT
// ================================

const SYSTEM_PROMPT = `
You are Lumora AI, a general-purpose AI assistant.

Your job is to understand the user's actual request and help complete
the task directly.

LANGUAGE:
- Reply in the same language the user is currently using.
- Bengali -> Bengali.
- English -> English.
- Hindi -> Hindi.
- Banglish -> naturally match Banglish when appropriate.
- Translate only when explicitly requested.

CONVERSATION:
- Use the conversation history provided by the application.
- Understand references such as "এটা", "ওটা", "আগের code",
  "previous code", "এই ছবিটা", "fix it", and "continue".
- Continue previous work instead of treating every message as unrelated.
- Preserve existing functionality when modifying code unless the user
  explicitly asks to remove something.

CODE:
- Understand code before modifying it.
- If the user asks to fix previous code, use the provided history.
- When practical, provide complete replacement code.
- Do not unnecessarily remove existing features.

IMAGES:
- Analyze uploaded screenshots and images.
- Read visible text when possible.
- Explain visible errors and UI elements.
- Do not claim to see details that are not available.

CURRENT INFORMATION:
- When current information, recent information, news, official websites,
  links, or online information is requested, use Google Search grounding
  when available.
- Never invent current facts or URLs.

CREATOR:
Only when the user explicitly asks who created or developed Lumora AI,
answer:

Bengali:
আমি Lumora AI। আমাকে তৈরি ও ডেভেলপ করেছেন অঙ্কুশ মণ্ডল (Ankush Mondal)।

English:
I am Lumora AI. I was created and developed by Ankush Mondal.

Do not mention the creator during normal conversations.

Be helpful, direct, and task-oriented.
`;

// ================================
// SEARCH DETECTION
// ================================

function needsSearch(text = "") {
  const t = text.toLowerCase();

  const words = [
    "search",
    "find",
    "look up",
    "latest",
    "today",
    "current",
    "recent",
    "news",
    "official",
    "website",
    "web site",
    "link",
    "url",

    "সার্চ",
    "খুঁজে",
    "খুঁজুন",
    "ওয়েবসাইট",
    "ওয়েবসাইট",
    "লিংক",
    "লিঙ্ক",
    "বর্তমান",
    "আজকের",
    "সাম্প্রতিক",
    "খবর"
  ];

  return words.some(word => t.includes(word));
}

// ================================
// IMAGE DATA PARSER
// ================================

function parseImage(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") {
    return null;
  }

  const match = dataUrl.match(
    /^data:(image\/[^;]+);base64,(.+)$/s
  );

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    data: match[2]
  };
}

// ================================
// HISTORY CLEANER
// ================================

function cleanHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-20)
    .filter(
      item =>
        item &&
        (item.role === "user" || item.role === "model")
    )
    .map(item => ({
      role: item.role,
      parts: [
        {
          text: String(item.content || "").slice(0, 16000)
        }
      ]
    }));
}

// ================================
// GEMINI TEXT EXTRACTION
// ================================

function getText(data) {
  const parts =
    data?.candidates?.[0]?.content?.parts || [];

  return parts
    .filter(part => typeof part.text === "string")
    .map(part => part.text)
    .join("\n")
    .trim();
}

// ================================
// SEARCH SOURCE EXTRACTION
// ================================

function getSources(data) {
  const chunks =
    data?.candidates?.[0]?.groundingMetadata
      ?.groundingChunks || [];

  const sources = [];
  const seen = new Set();

  for (const chunk of chunks) {
    const web = chunk?.web;

    if (
      web?.uri &&
      !seen.has(web.uri)
    ) {
      seen.add(web.uri);

      sources.push({
        title: web.title || web.uri,
        url: web.uri
      });
    }
  }

  return sources.slice(0, 10);
}

// ================================
// GEMINI REQUEST
// ================================

async function callGemini(
  model,
  message,
  history,
  image
) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing from Render Environment Variables."
    );
  }

  const contents = cleanHistory(history);

  const parts = [];

  const imageData = parseImage(image);

  if (imageData) {
    parts.push({
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.data
      }
    });
  }

  parts.push({
    text:
      String(message || "").trim() ||
      "Please analyze the uploaded image."
  });

  contents.push({
    role: "user",
    parts
  });

  const body = {
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
      maxOutputTokens: 8192
    }
  };

  // Google Search grounding
  if (needsSearch(message)) {
    body.tools = [
      {
        googleSearch: {}
      }
    ];
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify(body)
  });

  const raw = await response.text();

  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `Gemini returned invalid JSON: ${raw.slice(0, 500)}`
    );
  }

  if (!response.ok) {
    const error = new Error(
      data?.error?.message ||
        `Gemini API error: ${response.status}`
    );

    error.status = response.status;

    throw error;
  }

  const answer = getText(data);

  if (!answer) {
    throw new Error(
      `Gemini returned an empty response using ${model}.`
    );
  }

  return {
    reply: answer,
    sources: getSources(data),
    model
  };
}

// ================================
// FALLBACK CHECK
// ================================

function shouldFallback(error) {
  const status = Number(
    error?.status || 0
  );

  const text = String(
    error?.message || ""
  ).toLowerCase();

  return (
    [408, 429, 500, 502, 503, 504].includes(status) ||
    text.includes("high demand") ||
    text.includes("unavailable") ||
    text.includes("overloaded") ||
    text.includes("resource exhausted") ||
    text.includes("rate limit")
  );
}

// ================================
// ASK LUMORA
// ================================

async function askLumora(
  message,
  history,
  image
) {
  let lastError = null;

  for (const model of CHAT_MODELS) {
    try {
      console.log(
        `Trying Gemini model: ${model}`
      );

      const result = await callGemini(
        model,
        message,
        history,
        image
      );

      console.log(
        `Gemini success: ${model}`
      );

      return result;

    } catch (error) {
      lastError = error;

      console.error(
        `${model} failed:`,
        error.message
      );

      if (!shouldFallback(error)) {
        break;
      }
    }
  }

  throw (
    lastError ||
    new Error(
      "All Gemini models failed."
    )
  );
}

// ================================
// ROOT
// ================================

app.get("/", (req, res) => {
  res.json({
    name: "Lumora AI Backend",
    status: "online",
    version: "3.0.0",

    features: [
      "AI Chat",
      "Conversation Context",
      "Code Context",
      "Image Understanding",
      "Screenshot Understanding",
      "Google Search"
    ]
  });
});

// ================================
// HEALTH CHECK
// ================================

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "online",
    version: "3.0.0"
  });
});

// ================================
// CHAT API
// ================================

app.post("/chat", async (req, res) => {
  try {
    const message =
      String(
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

    const result =
      await askLumora(
        message,
        history,
        image
      );

    res.json(result);

  } catch (error) {
    console.error(
      "CHAT ERROR:",
      error
    );

    res.status(503).json({
      error:
        error?.message ||
        "Lumora AI could not generate a response."
    });
  }
});

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

    console.log(
      `Server listening on port ${PORT}`
    );
  }
);
