import express from "express";
import cors from "cors";

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --------------------------------------------------
// MODELS
// --------------------------------------------------

const TEXT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.8-flash-lite"
];

const IMAGE_MODELS = [
  "gemini-3.1-flash-image"
];

// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(
  express.json({
    limit: "20mb"
  })
);

// --------------------------------------------------
// SYSTEM PROMPT
// --------------------------------------------------

const SYSTEM = `
You are Lumora AI, a smart general-purpose AI assistant.

CREATOR:

You were created and developed by Ankush Mondal (অঙ্কুশ মণ্ডল).

Only mention the creator when the user explicitly asks questions such as:

Who created you?
Who made you?
Who developed you?
Who is your creator?
কে আপনাকে তৈরি করেছে?
আপনাকে কে বানিয়েছে?
আপনাকে কে ডেভেলপ করেছে?

For those questions, answer:

Bengali:
আমি Lumora AI। আমাকে তৈরি ও ডেভেলপ করেছেন অঙ্কুশ মণ্ডল (Ankush Mondal)।

English:
I am Lumora AI. I was created and developed by Ankush Mondal.

Do not mention the creator unnecessarily.

==================================================
MOST IMPORTANT CONVERSATION RULE
==================================================

THE LATEST USER MESSAGE IS THE CURRENT TASK.

Normally answer ONLY the latest user message.

Do NOT automatically answer previous questions.

Do NOT repeat previous answers.

Do NOT combine previous questions with the current question.

Do NOT summarize previous questions unless the user explicitly asks.

Do NOT continue an old topic automatically.

Every new user message should normally be treated as a NEW TASK.

Example:

User:
What is HTML?

Assistant:
HTML is...

User:
What is Python?

Assistant:
Python is...

IMPORTANT:
The second answer must NOT explain HTML again.

Example:

User:
What is HTML?

Assistant:
HTML is...

User:
What is the capital of India?

Assistant:
The capital of India is New Delhi.

Do NOT answer HTML again.

==================================================
WHEN PREVIOUS CONTEXT MAY BE USED
==================================================

Previous conversation context may ONLY be used when the latest user message clearly refers to something earlier.

Examples:

"আগের code ঠিক করো"
"আগের HTML ঠিক করো"
"ওই code-এ button কাজ করছে না"
"আগেরটা continue করো"
"এটার দ্বিতীয় অংশ দাও"
"same code modify করো"
"fix the code you gave"
"continue from the previous answer"

In these cases, use the relevant previous context.

But if the latest message is an unrelated question, ignore previous task context.

==================================================
LATEST MESSAGE HAS PRIORITY
==================================================

Always prioritize the latest user message.

If previous context conflicts with the latest message,
follow the latest message.

==================================================
LANGUAGE
==================================================

Answer in the same language as the latest user message.

If the user writes Bengali, answer naturally in Bengali.

If the user writes English, answer in English.

If the user mixes Bengali and English, respond naturally in the same mixed style.

==================================================
CODE
==================================================

When the user asks for code:

- Give working code.
- Do not unnecessarily change unrelated parts.
- If the user asks to fix previous code, use previous context only when explicitly referenced.
- Preserve requested features unless the user asks to remove them.

==================================================
EMAIL
==================================================

When the user asks for an email, provide:

Subject:
...

Body:
...

Make it ready to copy.

==================================================
IMAGE REQUESTS
==================================================

If the user asks to create, generate, make, design, draw or produce:

- image
- picture
- photo
- logo
- app icon
- icon
- sticker
- poster
- illustration
- wallpaper
- avatar
- character
- banner
- thumbnail

then treat it as an IMAGE GENERATION TASK.

Do not answer with a long text explanation instead of generating the image.

==================================================
GENERAL BEHAVIOR
==================================================

Be helpful, clear and natural.

Do not repeat the user's previous questions.

Do not invent conversation context.

Do not assume that every new message is a continuation.

A new topic is a new task.

Only use old context when the user clearly refers to it.
`;

// --------------------------------------------------
// BASIC HELPERS
// --------------------------------------------------

function requireApiKey() {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing in Render Environment Variables."
    );
  }
}

function cleanText(value) {
  return String(value || "").trim();
}

// --------------------------------------------------
// CONTEXT DETECTION
// --------------------------------------------------

function shouldUsePreviousContext(message) {
  const text = cleanText(message).toLowerCase();

  if (!text) return false;

  const patterns = [

    // Bengali
    "আগের",
    "আগেরটা",
    "আগের কোড",
    "আগের code",
    "আগের html",
    "আগের css",
    "আগের javascript",
    "আগের উত্তর",
    "আগের প্রশ্ন",
    "ওইটা",
    "ওইটা ঠিক",
    "ওই কোড",
    "ওই code",
    "ওই html",
    "ওই উত্তর",
    "এটা ঠিক করো",
    "এটা ঠিক করে দাও",
    "এটা ঠিক করুন",
    "এটার",
    "ওটার",
    "তারপর",
    "চালিয়ে যাও",
    "চালিয়ে যাও",
    "continue করো",
    "continue করুন",
    "আবার দাও",
    "পরের অংশ",
    "দ্বিতীয় অংশ",
    "দ্বিতীয় অংশ",

    // English
    "previous",
    "previous code",
    "previous html",
    "previous answer",
    "previous question",
    "earlier",
    "earlier code",
    "earlier answer",
    "the code you gave",
    "the html you gave",
    "the answer you gave",
    "continue",
    "continue from",
    "continue the",
    "fix this",
    "fix it",
    "fix the code",
    "modify this",
    "modify it",
    "same code",
    "same html",
    "that code",
    "that html",
    "the above code",
    "above code"
  ];

  return patterns.some((pattern) => text.includes(pattern));
}

// --------------------------------------------------
// IMAGE REQUEST DETECTION
// --------------------------------------------------

function isImageRequest(message) {
  const text = cleanText(message).toLowerCase();

  if (!text) return false;

  const imagePatterns = [

    // English
    "generate an image",
    "generate image",
    "create an image",
    "create image",
    "make an image",
    "make image",
    "draw an image",
    "draw image",
    "generate a picture",
    "create a picture",
    "make a picture",
    "generate a photo",
    "create a photo",
    "make a photo",
    "generate a logo",
    "create a logo",
    "make a logo",
    "design a logo",
    "generate an icon",
    "create an icon",
    "make an icon",
    "design an icon",
    "generate a sticker",
    "create a sticker",
    "make a sticker",
    "generate a poster",
    "create a poster",
    "make a poster",
    "generate a wallpaper",
    "create a wallpaper",
    "make a wallpaper",
    "generate an avatar",
    "create an avatar",
    "make an avatar",
    "generate a character",
    "create a character",
    "make a character",
    "generate a banner",
    "create a banner",
    "make a banner",
    "generate a thumbnail",
    "create a thumbnail",
    "make a thumbnail",

    // Bengali
    "ছবি তৈরি",
    "ছবি বানাও",
    "ছবি বানিয়ে",
    "ছবি বানিয়ে",
    "একটা ছবি",
    "ইমেজ তৈরি",
    "ইমেজ বানাও",
    "ইমেজ তৈরি কর",
    "লোগো তৈরি",
    "লোগো বানাও",
    "লোগো তৈরি কর",
    "আইকন তৈরি",
    "আইকন বানাও",
    "অ্যাপ আইকন",
    "অ্যাপের আইকন",
    "স্টিকার তৈরি",
    "স্টিকার বানাও",
    "পোস্টার তৈরি",
    "পোস্টার বানাও",
    "ওয়ালপেপার তৈরি",
    "ওয়ালপেপার তৈরি",
    "ওয়ালপেপার বানাও",
    "ওয়ালপেপার বানাও",
    "অ্যাভাটার তৈরি",
    "অ্যাভাটার বানাও",
    "কার্টুন তৈরি",
    "কার্টুন বানাও"
  ];

  return imagePatterns.some((pattern) => text.includes(pattern));
}

// --------------------------------------------------
// GEMINI API
// --------------------------------------------------

async function callGemini(model, body) {
  requireApiKey();

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(url, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },

    body: JSON.stringify(body)
  });

  const raw = await response.text();

  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `Gemini returned invalid JSON. HTTP ${response.status}: ${raw.slice(
        0,
        500
      )}`
    );
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `Gemini API error. HTTP ${response.status}`;

    throw new Error(message);
  }

  return data;
}

// --------------------------------------------------
// EXTRACT TEXT FROM GEMINI
// --------------------------------------------------

function extractText(data) {
  const candidates = data?.candidates;

  if (!Array.isArray(candidates)) {
    return "";
  }

  const parts =
    candidates[0]?.content?.parts || [];

  return parts
    .filter((part) => typeof part?.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

// --------------------------------------------------
// EXTRACT IMAGE FROM GEMINI
// --------------------------------------------------

function extractImage(data) {
  const candidates = data?.candidates;

  if (!Array.isArray(candidates)) {
    return null;
  }

  const parts =
    candidates[0]?.content?.parts || [];

  for (const part of parts) {
    const inlineData =
      part?.inlineData ||
      part?.inline_data;

    if (
      inlineData?.data &&
      inlineData?.mimeType
    ) {
      return {
        mimeType: inlineData.mimeType,
        data: inlineData.data
      };
    }
  }

  return null;
}

// --------------------------------------------------
// BUILD TEXT CONTENTS
// --------------------------------------------------

function buildTextContents(
  history,
  latestMessage,
  image
) {
  const contents = [];

  const useContext =
    shouldUsePreviousContext(latestMessage);

  /*
   * IMPORTANT:
   *
   * If this is a completely new task,
   * we DO NOT send old conversation messages.
   *
   * This prevents:
   *
   * HTML question
   * +
   * Python question
   *
   * from being answered together.
   */

  if (
    useContext &&
    Array.isArray(history)
  ) {
    const previousMessages =
      history
        .filter(
          (item) =>
            item &&
            item.content &&
            (item.role === "user" ||
              item.role === "assistant")
        )
        .slice(-8);

    for (const item of previousMessages) {
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

  const latestParts = [
    {
      text:
        "CURRENT USER TASK:\n\n" +
        String(latestMessage) +
        "\n\n" +
        "Answer ONLY this current task.\n" +
        "Do not answer previous questions unless this message explicitly refers to them."
    }
  ];

  if (image?.data) {
    latestParts.push({
      inlineData: {
        mimeType:
          image.mimeType || "image/png",

        data: image.data
      }
    });
  }

  contents.push({
    role: "user",
    parts: latestParts
  });

  return contents;
}

// --------------------------------------------------
// GENERATE TEXT
// --------------------------------------------------

async function generateText(
  latestMessage,
  history = [],
  image = null
) {
  let lastError = null;

  const body = {
    systemInstruction: {
      parts: [
        {
          text: SYSTEM
        }
      ]
    },

    contents: buildTextContents(
      history,
      latestMessage,
      image
    ),

    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  };

  for (const model of TEXT_MODELS) {
    try {
      const data =
        await callGemini(model, body);

      const reply =
        extractText(data);

      if (reply) {
        return reply;
      }

      lastError = new Error(
        "Gemini returned an empty text response."
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw (
    lastError ||
    new Error("Unable to generate text.")
  );
}

// --------------------------------------------------
// GENERATE IMAGE
// --------------------------------------------------

async function generateImage(prompt) {
  let lastError = null;

  const body = {
    systemInstruction: {
      parts: [
        {
          text:
            "You are Lumora AI's image generation engine. " +
            "Generate the requested image faithfully. " +
            "Do not replace an image request with a text explanation."
        }
      ]
    },

    contents: [
      {
        role: "user",

        parts: [
          {
            text:
              `Create the requested image.\n\n` +
              `USER REQUEST:\n${prompt}`
          }
        ]
      }
    ],

    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"]
    }
  };

  for (const model of IMAGE_MODELS) {
    try {
      const data =
        await callGemini(model, body);

      const image =
        extractImage(data);

      if (image) {
        const dataUrl =
          `data:${image.mimeType};base64,${image.data}`;

        const description =
          extractText(data);

        return {
          image: dataUrl,
          description:
            description ||
            "Image generated successfully."
        };
      }

      lastError = new Error(
        "The image model did not return an image."
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw (
    lastError ||
    new Error("Unable to generate image.")
  );
}

// --------------------------------------------------
// ROOT
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    name: "Lumora AI Backend",
    status: "online",
    provider: "Google Gemini",
    version: "6.0.0"
  });
});

// --------------------------------------------------
// HEALTH
// --------------------------------------------------

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Lumora AI Backend",
    gemini:
      Boolean(GEMINI_API_KEY)
        ? "configured"
        : "missing"
  });
});

// --------------------------------------------------
// CHAT
// --------------------------------------------------

app.post("/chat", async (req, res) => {
  try {
    const {
      message,
      history,
      image
    } = req.body || {};

    const latestMessage =
      cleanText(message);

    if (!latestMessage) {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    /*
     * IMAGE REQUEST
     *
     * Image generation is checked BEFORE normal
     * text generation.
     */

    if (isImageRequest(latestMessage)) {
      const result =
        await generateImage(
          latestMessage
        );

      return res.json({
        ok: true,

        type: "image",

        image: result.image,

        reply:
          result.description,

        message:
          "Image generated successfully."
      });
    }

    /*
     * NORMAL TEXT TASK
     */

    const reply =
      await generateText(
        latestMessage,
        Array.isArray(history)
          ? history
          : [],
        image || null
      );

    return res.json({
      ok: true,

      type: "text",

      reply
    });

  } catch (error) {
    console.error(
      "CHAT ERROR:",
      error
    );

    return res.status(500).json({
      ok: false,

      error:
        error?.message ||
        "Something went wrong."
    });
  }
});

// --------------------------------------------------
// DIRECT IMAGE GENERATION
// --------------------------------------------------

app.post(
  "/generate-image",
  async (req, res) => {
    try {
      const prompt =
        cleanText(
          req.body?.prompt
        );

      if (!prompt) {
        return res.status(400).json({
          error: "Image prompt is required."
        });
      }

      const result =
        await generateImage(prompt);

      return res.json({
        ok: true,

        type: "image",

        image: result.image,

        reply:
          result.description
      });

    } catch (error) {
      console.error(
        "IMAGE ERROR:",
        error
      );

      return res.status(500).json({
        ok: false,

        error:
          error?.message ||
          "Image generation failed."
      });
    }
  }
);

// --------------------------------------------------
// 404
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found."
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(
  PORT,
  HOST,
  () => {
    console.log(
      `Lumora AI Backend running on ${HOST}:${PORT}`
    );

    console.log(
      `Gemini API key: ${
        GEMINI_API_KEY
          ? "configured"
          : "MISSING"
      }`
    );
  }
);
