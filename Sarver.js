import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "30mb" }));

/* =========================
   MODELS
========================= */

const CHAT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite"
];

const IMAGE_MODEL = "gemini-3.1-flash-image";

/* =========================
   LUMORA SYSTEM
========================= */

const SYSTEM_PROMPT = `
You are Lumora AI, a general-purpose AI assistant.

Your job is to understand the user's actual request, remember the
conversation context provided to you, and continue the user's work
instead of treating every message as a completely new request.

========================
LANGUAGE
========================

- Reply in the same language the user is currently using.
- Bengali → Bengali.
- English → English.
- Hindi → Hindi.
- Banglish → naturally match the user's Banglish when appropriate.
- If the user explicitly asks for a language, follow that instruction.
- NEVER translate automatically.
- Translate ONLY when the user explicitly asks for translation.

========================
CONTEXT UNDERSTANDING
========================

The conversation history is important.

Understand references such as:

- "এটা"
- "ওটা"
- "ওই code"
- "আগের code"
- "এই ছবিটা"
- "আগেরটা"
- "ওটার মধ্যে এটা add করো"
- "এটা নিয়েই এগিয়ে যাও"
- "continue"
- "fix this"
- "the code you gave me"
- "that screenshot"
- "the previous version"

When the user refers to something from the previous conversation,
use the provided conversation history to determine what they mean.

Do NOT ask the user to repeat something that is clearly available
in the conversation history.

If the user provides code and then asks to modify "that code",
continue working on that code.

If the user provides an image/screenshot and then refers to "that image",
use the image context when it is available.

Preserve existing functionality when modifying code unless the user
specifically asks to remove or change it.

========================
CODE CONTEXT
========================

When the user gives code:

- Understand the code before responding.
- Remember its purpose within the conversation.
- If the user later says "fix it", identify the relevant previous code.
- If the user says "add this to the previous code", integrate it into
  the previous code.
- Do not unnecessarily remove existing features.
- When providing a replacement file, provide the complete file when
  practical.
- Keep the user's requested functionality intact.

========================
IMAGE / SCREENSHOT UNDERSTANDING
========================

When an image or screenshot is provided:

- Analyze what is visible.
- Read visible text when possible.
- Understand UI elements.
- Identify visible errors.
- Explain what the screenshot shows.
- If the user asks what to do next, provide actionable steps.
- If the screenshot contains code, understand the visible code.
- If the user asks to modify something based on the screenshot,
  use the screenshot as context.

Do not claim to see details that are not actually available.

========================
WEB / CURRENT INFORMATION
========================

When the user asks for:

- latest information
- current information
- today's information
- news
- websites
- official links
- current services
- recent information
- something to search/find online

use web search when available.

Never invent a website, URL, search result, or current fact.

========================
IMAGE GENERATION
========================

If the user asks to create, generate, design, make, or edit an image,
the backend image-generation endpoint should be used.

Understand requests such as:

- "create an image"
- "make a logo"
- "make a banner"
- "make a poster"
- "make an icon"
- "generate a picture"
- "create Nano Banana image"
- "edit this image"
- "turn this sketch into an image"

If an image is supplied as a reference, use it as part of the image
generation request when supported.

========================
CREATOR
========================

Only when explicitly asked who created or developed Lumora AI:

Bengali:
আমি Lumora AI। আমাকে তৈরি ও ডেভেলপ করেছেন অঙ্কুশ মণ্ডল (Ankush Mondal)।

English:
I am Lumora AI. I was created and developed by Ankush Mondal.

Do not mention the creator during normal conversations.

========================
IMPORTANT
========================

Be a task-oriented assistant.

Do not merely explain how something could be done when the user is
asking you to actually produce the code/content needed.

Use the conversation context to continue the user's work.
`;

/* =========================
   SEARCH DETECTION
========================= */

function needsSearch(text = "") {
  const t = text.toLowerCase();

  const searchWords = [
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

  return searchWords.some(word =>
    t.includes(word)
  );
}

/* =========================
   IMAGE PARSER
========================= */

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

/* =========================
   HISTORY
========================= */

function cleanHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-20)
    .filter(item => {
      return (
        item &&
        (item.role === "user" ||
          item.role === "model")
      );
    })
    .map(item => ({
      role: item.role,
      parts: [
        {
          text: String(
            item.content || ""
          ).slice(0, 16000)
        }
      ]
    }));
}

/* =========================
   RESPONSE TEXT
========================= */

function getText(data) {
  const parts =
    data?.candidates?.[0]?.content?.parts || [];

  return parts
    .filter(
      part =>
        typeof part.text === "string"
    )
    .map(part => part.text)
    .join("\n")
    .trim();
}

/* =========================
   SEARCH SOURCES
========================= */

function getSources(data) {
  const chunks =
    data?.candidates?.[0]
      ?.groundingMetadata
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
        title:
          web.title ||
          web.uri,
        url: web.uri
      });
    }
  }

  return sources.slice(0, 10);
}

/* =========================
   GEMINI CHAT
========================= */

async function callGemini(
  model,
  message,
  history,
  image
) {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing from Render Environment Variables."
    );
  }

  const contents =
    cleanHistory(history);

  const parts = [];

  const imageData =
    parseImage(image);

  /*
    If an image/screenshot is supplied,
    send it together with the user's message.
  */

  if (imageData) {
    parts.push({
      inlineData: {
        mimeType:
          imageData.mimeType,
        data:
          imageData.data
      }
    });
  }

  parts.push({
    text:
      String(
        message ||
          "Please analyze the uploaded image."
      )
  });

  contents.push({
    role: "user",
    parts
  });

  const body = {
    systemInstruction: {
      parts: [
        {
          text:
            SYSTEM_PROMPT
        }
      ]
    },

    contents,

    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  };

  /*
    Enable Google Search when
    the request appears to require
    current/web information.
  */

  if (needsSearch(message)) {
    body.tools = [
      {
        googleSearch: {}
      }
    ];
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response =
    await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body:
        JSON.stringify(body)
    });

  const raw =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(raw);
  } catch {
    throw new Error(
      `Gemini returned invalid JSON: ${raw.slice(0, 500)}`
    );
  }

  if (!response.ok) {
    const error =
      new Error(
        data?.error?.message ||
        `Gemini API error: ${response.status}`
      );

    error.status =
      response.status;

    throw error;
  }

  const answer =
    getText(data);

  if (!answer) {
    throw new Error(
      `Gemini returned an empty response using ${model}.`
    );
  }

  return {
    reply: answer,
    sources:
      getSources(data),
    model
  };
}

/* =========================
   FALLBACK
========================= */

function shouldFallback(error) {
  const status =
    Number(
      error?.status || 0
    );

  const text =
    String(
      error?.message || ""
    ).toLowerCase();

  return (
    [
      408,
      429,
      500,
      502,
      503,
      504
    ].includes(status) ||

    text.includes(
      "high demand"
    ) ||

    text.includes(
      "unavailable"
    ) ||

    text.includes(
      "overloaded"
    ) ||

    text.includes(
      "resource exhausted"
    ) ||

    text.includes(
      "rate limit"
    )
  );
}

/* =========================
   ASK LUMORA
========================= */

async function askLumora(
  message,
  history,
  image
) {
  let lastError = null;

  for (
    const model of CHAT_MODELS
  ) {
    try {
      console.log(
        `Trying chat model: ${model}`
      );

      const result =
        await callGemini(
          model,
          message,
          history,
          image
        );

      console.log(
        `Chat success: ${model}`
      );

      return result;

    } catch (error) {
      lastError =
        error;

      console.error(
        `${model} failed:`,
        error.message
      );

      if (
        !shouldFallback(error)
      ) {
        break;
      }
    }
  }

  throw (
    lastError ||
    new Error(
      "All Gemini chat models failed."
    )
  );
}

/* =========================
   IMAGE GENERATION
   Nano Banana
========================= */

async function generateImage(
  prompt,
  image
) {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing from Render Environment Variables."
    );
  }

  const input = [];

  const imageData =
    parseImage(image);

  /*
    Reference image + prompt
  */

  if (imageData) {
    input.push({
      type: "image",
      mime_type:
        imageData.mimeType,
      data:
        imageData.data
    });
  }

  input.push({
    type: "text",
    text: String(
      prompt ||
      "Create a high-quality image."
    )
  });

  const body = {
    model:
      IMAGE_MODEL,

    input,

    response_format: {
      type: "image",
      mime_type:
        "image/png",
      aspect_ratio:
        "1:1",
      image_size:
        "1K"
    }
  };

  const response =
    await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",

        headers: {
          "x-goog-api-key":
            apiKey,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(body)
      }
    );

  const raw =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(raw);
  } catch {
    throw new Error(
      `Image API returned invalid JSON: ${raw.slice(0, 500)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `Image generation failed: ${response.status}`
    );
  }

  /*
    First try convenience output_image.
  */

  if (
    data?.output_image?.data
  ) {
    return {
      image:
        `data:${data.output_image.mime_type || "image/png"};base64,${data.output_image.data}`,

      mimeType:
        data.output_image.mime_type ||
        "image/png"
    };
  }

  /*
    Fallback:
    inspect interaction steps.
  */

  for (
    const step of
      data?.steps || []
  ) {
    if (
      step?.type !==
      "model_output"
    ) {
      continue;
    }

    for (
      const block of
        step?.content || []
    ) {
      if (
        block?.type ===
          "image" &&
        block?.data
      ) {
        return {
          image:
            `data:${block.mime_type || "image/png"};base64,${block.data}`,

          mimeType:
            block.mime_type ||
            "image/png"
        };
      }
    }
  }

  throw new Error(
    "The image model completed, but no image was returned."
  );
}

/* =========================
   ROOT
========================= */

app.get(
  "/",
  (req, res) => {
    res.json({
      name:
        "Lumora AI Backend",

      status:
        "online",

      version:
        "2.0.0",

      features: [
        "AI Chat",
        "Conversation Context",
        "Code Context",
        "Image Understanding",
        "Screenshot Understanding",
        "Google Search",
        "Image Generation"
      ]
    });
  }
);

/* =========================
   HEALTH
========================= */

app.get(
  "/health",
  (req, res) => {
    res.json({
      ok: true,
      status: "online",
      version: "2.0.0"
    });
  }
);

/* =========================
   CHAT ENDPOINT
========================= */

app.post(
  "/chat",
  async (req, res) => {
    try {
      const message =
        String(
          req.body?.message ||
          ""
        ).trim();

      const history =
        req.body?.history ||
        [];

      const image =
        req.body?.image ||
        null;

      if (
        !message &&
        !image
      ) {
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
  }
);

/* =========================
   IMAGE GENERATION ENDPOINT
========================= */

app.post(
  "/generate-image",
  async (req, res) => {
    try {
      const prompt =
        String(
          req.body?.prompt ||
          ""
        ).trim();

      const image =
        req.body?.image ||
        null;

      if (!prompt) {
        return res.status(400).json({
          error:
            "Image prompt is required."
        });
      }

      const result =
        await generateImage(
          prompt,
          image
        );

      res.json({
        success: true,
        image:
          result.image,
        mimeType:
          result.mimeType
      });

    } catch (error) {
      console.error(
        "IMAGE ERROR:",
        error
      );

      res.status(503).json({
        error:
          error?.message ||
          "Image generation failed."
      });
    }
  }
);

/* =========================
   START SERVER
========================= */

app.listen(
  PORT,
  () => {
    console.log(
      `Lumora AI Backend running on port ${PORT}`
    );
  }
);