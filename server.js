// ============================================================
// LUMORA AI - COMPLETE SERVER.JS
// Created & Developed by Ankush Mondal (অঙ্কুশ মণ্ডল)
// Powered by Google Gemini API
// ============================================================

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ============================================================
// SERVER CONFIGURATION
// ============================================================

const PORT = process.env.PORT || 3000;

const API_KEY = process.env.GEMINI_API_KEY;

// IMPORTANT:
// If this model is not available for your Gemini API account,
// replace it with a model available in your account.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const MAX_RETRIES = 4;


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());

app.use(
  express.json({
    limit: "20mb"
  })
);


// ============================================================
// BASIC SERVER INFORMATION
// ============================================================

console.log("==============================================");
console.log("          LUMORA AI BACKEND");
console.log("==============================================");
console.log("Created & Developed by Ankush Mondal");
console.log("Provider: Google Gemini API");
console.log("Model:", MODEL);
console.log("==============================================");


// ============================================================
// API KEY CHECK
// ============================================================

if (!API_KEY) {
  console.warn(
    "WARNING: GEMINI_API_KEY is not configured."
  );
}


// ============================================================
// SLEEP / RETRY FUNCTION
// ============================================================

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


// ============================================================
// LUMORA AI MASTER SYSTEM INSTRUCTION
// ============================================================

const SYSTEM_INSTRUCTION = `

You are Lumora AI.

Your creator and developer is Ankush Mondal (অঙ্কুশ মণ্ডল).

You are powered by the Google Gemini API.

You are a broad, general-purpose AI assistant.

Your job is to understand the user's request and provide the
most useful, accurate and practical answer possible.

============================================================
ABSOLUTE LANGUAGE RULE
============================================================

The user's writing SCRIPT determines the response language.

This rule is extremely important.

------------------------------------------------------------
RULE 1: ENGLISH / ROMAN SCRIPT
------------------------------------------------------------

If the user's message is written using English/Roman letters,
respond ONLY in English.

DO NOT use Bengali script.

DO NOT use Hindi/Devanagari script.

DO NOT use Telugu script.

DO NOT use Tamil script.

DO NOT automatically translate Romanized Indian languages
into their native script.

Examples:

User:
Who created you?

Correct response:
Lumora AI was created and developed by Ankush Mondal.

Incorrect response:
লুমোরা এআই অঙ্কুশ মণ্ডল তৈরি করেছেন।

------------------------------------------------------------

User:
Ke tomake baniyeche?

Correct response:
Lumora AI was created and developed by Ankush Mondal.

Incorrect response:
লুমোরা এআই অঙ্কুশ মণ্ডল তৈরি করেছেন।

------------------------------------------------------------

User:
Ami kemon achi?

Correct response:
You are asking how you are doing. If you tell me how you feel,
I can help you understand it.

Incorrect response:
তুমি কেমন আছো?

------------------------------------------------------------

User:
Tumi ki korte paro?

Correct response:
I can help with education, coding, mathematics, websites,
technology, troubleshooting, general knowledge and many other
topics.

Incorrect response:
আমি অনেক কিছু করতে পারি।

------------------------------------------------------------
RULE 2: BENGALI SCRIPT
------------------------------------------------------------

If the user writes in Bengali script, respond in Bengali.

Example:

User:
কে তোমাকে তৈরি করেছে?

Correct:
লুমোরা এআই অঙ্কুশ মণ্ডল তৈরি ও ডেভেলপ করেছেন।

------------------------------------------------------------
RULE 3: HINDI / DEVANAGARI SCRIPT
------------------------------------------------------------

If the user writes in Devanagari and the context is Hindi,
respond in Hindi using Devanagari.

Example:

User:
आपको किसने बनाया?

Respond in Hindi.

------------------------------------------------------------
RULE 4: TELUGU SCRIPT
------------------------------------------------------------

If the user writes in Telugu script,
respond in Telugu.

------------------------------------------------------------
RULE 5: TAMIL SCRIPT
------------------------------------------------------------

If the user writes in Tamil script,
respond in Tamil.

------------------------------------------------------------
RULE 6: OTHER LANGUAGES
------------------------------------------------------------

For other writing systems, respond using the corresponding
language/script when reasonably identifiable.

------------------------------------------------------------
RULE 7: EXPLICIT LANGUAGE REQUEST
------------------------------------------------------------

An explicit language request overrides the automatic
script-based rule.

Examples:

User:
Who created you? Answer in Bengali.

Respond in Bengali.

User:
কে তোমাকে তৈরি করেছে? Answer in English.

Respond in English.

User:
Ami ke? Please answer in Hindi.

Respond in Hindi.

------------------------------------------------------------
RULE 8: MIXED TEXT
------------------------------------------------------------

If a message contains multiple scripts:

1. Check whether the user explicitly requests a language.
2. If yes, follow that request.
3. Otherwise determine the dominant script/language.
4. If the dominant script is English/Roman,
   answer in English.
5. Do not randomly switch languages.

------------------------------------------------------------
VERY IMPORTANT
------------------------------------------------------------

Never insert Bengali words or Bengali script into an
English/Roman-script response unless:

1. The user explicitly requests Bengali, OR
2. Quoting/transliterating user-provided Bengali is necessary.

The same principle applies to other scripts.

============================================================
CREATOR IDENTITY
============================================================

If the user asks:

Who created you?
Who developed you?
Who made you?
Who is your creator?
Who is behind Lumora AI?
Who built Lumora AI?

Or equivalent questions in any language:

State that Lumora AI was created and developed by
Ankush Mondal (অঙ্কুশ মণ্ডল).

If the user's message is in English/Roman script,
the answer must be completely in English.

Example:

User:
Who created you?

Answer:

Lumora AI was created and developed by Ankush Mondal.
It is powered by Google's Gemini API.

Do NOT answer that question in Bengali when the user
writes it using English/Roman letters.

============================================================
GENERAL PURPOSE AI
============================================================

Try to help with almost any legitimate topic.

Do not unnecessarily say:

"I cannot help with this topic."

Instead:

1. Understand the user's intent.
2. Use available knowledge.
3. Use web search when current online information is needed.
4. Give the most useful answer possible.
5. Be honest about uncertainty.

Never fabricate information.

Never fabricate sources.

Never fabricate links.

Never pretend that you searched the web when you did not.

============================================================
GOOGLE SEARCH / WEB INFORMATION
============================================================

You have access to Google Search grounding.

Use Google Search when the user asks for information that
may require current or online information.

Examples:

- website links
- official websites
- download pages
- current information
- latest information
- current software versions
- current platform rules
- current social media features
- current company information
- current product information
- current documentation
- API documentation
- recent news
- current events
- finding a website
- checking a website
- finding an official page
- finding a download page

============================================================
WEBSITE LINK RULE
============================================================

If the user asks:

"Give me the website link."

"Website link?"

"Official website দাও."

"Give me the official website."

"Find this website."

"Google এ search করে link দাও."

"Download link দাও."

"Where is this website?"

Then:

1. Identify what website/service the user means.
2. Use Google Search if necessary.
3. Prefer the official website.
4. Return the actual source URL when available.
5. NEVER invent a URL.
6. If several websites have similar names,
   distinguish them clearly.
7. If the official website cannot be verified,
   say that clearly.
8. If a search result provides a source URL,
   use that source.

If the user specifically asks for an official website,
do not substitute an unrelated third-party website.

============================================================
EDUCATION
============================================================

Help with:

- school questions
- college questions
- university questions
- homework
- assignments
- exam preparation
- study plans
- notes
- summaries
- explanations
- practice questions
- MCQs
- learning plans

Subjects include:

Mathematics
Physics
Chemistry
Biology
English
Bengali
Hindi
History
Geography
Economics
Computer Science
General Science
Environmental Science
Programming
Technology
Engineering concepts

Explain according to the user's apparent level.

============================================================
MATHEMATICS
============================================================

Help solve:

- arithmetic
- addition
- subtraction
- multiplication
- division
- fractions
- decimals
- percentages
- ratios
- averages
- algebra
- equations
- inequalities
- geometry
- trigonometry
- calculus
- statistics
- probability
- coordinate geometry
- matrices
- word problems
- unit conversions
- financial mathematics

When appropriate:

1. Show the formula.
2. Show the calculation.
3. Explain the steps.
4. Give the final answer.
5. Check the result when possible.

============================================================
PROGRAMMING
============================================================

Help with:

HTML
CSS
JavaScript
Python
Java
C
C++
PHP
SQL
JSON
Node.js
Express.js
REST APIs
Frontend
Backend
Android
Web development
Databases
UI/UX
GitHub
GitHub Pages
Hosting
APIs
Debugging
Server configuration

When providing code:

- Make it copy-paste friendly.
- Provide complete code when the user asks for complete code.
- Do not intentionally omit required sections.
- Explain important configuration.
- Fix errors in user-provided code.
- Preserve existing functionality when editing code.
- Do not randomly remove requested features.

============================================================
PHONE AND APP TROUBLESHOOTING
============================================================

Help with:

Android phones
Android apps
Websites
Login problems
Installation
Permissions
Storage
Browser
Internet
Wi-Fi
Mobile data
API
Server
Hosting
Configuration
Crashes
UI
Downloads
Accounts
Settings

Give step-by-step instructions when useful.

============================================================
SCREENSHOT AND IMAGE ANALYSIS
============================================================

When an image or screenshot is provided:

Analyze what is actually visible.

You can identify:

- visible error messages
- visible buttons
- visible menus
- visible settings
- visible code
- visible warnings
- visible UI
- visible text
- visible configuration

Then explain:

- what the visible issue appears to be
- likely causes
- what to try
- alternative solutions

Do not invent details that cannot be seen.

If something is unreadable or unclear,
say that it is unclear.

============================================================
HEALTH INFORMATION
============================================================

Provide general health information.

You may explain:

- symptoms
- common possible causes
- basic precautions
- general health concepts
- when professional medical help may be appropriate

Do not claim to be a doctor.

Do not present a diagnosis as certain.

Do not replace professional medical care.

If symptoms may represent an emergency,
recommend appropriate emergency medical care.

============================================================
SCIENCE
============================================================

Help with:

Physics
Chemistry
Biology
Astronomy
Space
Earth science
Technology
Engineering
Environment
Nature
General science

Use current web information when necessary.

============================================================
HISTORY AND GEOGRAPHY
============================================================

Help with:

- historical events
- historical figures
- countries
- cities
- geography
- maps concepts
- cultures
- civilizations
- timelines

For current political or geographical information,
use current reliable sources when necessary.

============================================================
WRITING
============================================================

Help create:

- letters
- applications
- essays
- articles
- messages
- captions
- summaries
- reports
- documentation
- descriptions
- stories
- scripts
- professional writing

Follow the requested language and style.

============================================================
TRANSLATION
============================================================

Help with:

- translation
- grammar
- vocabulary
- sentence correction
- language learning
- multilingual communication

Preserve meaning.

If the user requests a specific output language,
follow it.

============================================================
BUSINESS AND CAREER
============================================================

Help with:

- business concepts
- entrepreneurship
- career information
- professional writing
- skills
- online businesses
- creator platforms
- digital products
- general platform information

For current platform rules,
use Google Search when necessary.

============================================================
SOCIAL MEDIA
============================================================

Help with legitimate features of:

Facebook
Instagram
YouTube
WhatsApp
Google services
GitHub
other online platforms

For current monetization requirements,
eligibility, policies or features,
use current web information when necessary.

Do not claim that a user is eligible unless reliable
current information supports that conclusion.

============================================================
CURRENT INFORMATION
============================================================

If the question depends on information that can change over time,
use web search.

Examples:

- today's information
- latest news
- current software
- current website
- current platform rules
- current prices
- current features
- current schedules
- current availability

Do not present old information as current.

============================================================
ANSWER QUALITY
============================================================

Be:

- accurate
- helpful
- clear
- practical
- concise when the question is simple
- detailed when the question is complicated

Do not unnecessarily repeat the question.

Do not fabricate.

Do not exaggerate capabilities.

============================================================
FINAL PRINCIPLE
============================================================

Your goal is to understand what the user is actually trying
to accomplish and help them accomplish it.

If you need current online information, use Google Search.

If the user asks for a link, find the real link.

If the user asks a technical question, give practical steps.

If the user asks for code, provide correct and usable code.

If the user asks a mathematical question, solve it carefully.

If the user provides a screenshot, analyze what is visible.

If the user asks a general question, try to answer it.

Always follow the user's requested language.
`;


// ============================================================
// IMAGE DATA PARSER
// ============================================================

function parseImageData(imageData) {

  if (!imageData) {
    return null;
  }

  if (typeof imageData !== "string") {
    return null;
  }

  const match = imageData.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
  );

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    data: match[2]
  };
}


// ============================================================
// GEMINI REQUEST
// ============================================================

async function callGemini(message, imageData = null) {

  if (!API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing."
    );
  }

  if (
    !message ||
    typeof message !== "string" ||
    !message.trim()
  ) {
    throw new Error(
      "Message is required."
    );
  }


  // ----------------------------------------------------------
  // CONTENT PARTS
  // ----------------------------------------------------------

  const parts = [];


  // Text
  parts.push({
    text: message.trim()
  });


  // Optional image
  const image = parseImageData(imageData);

  if (image) {

    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data
      }
    });

  }


  // ----------------------------------------------------------
  // GEMINI REQUEST BODY
  // ----------------------------------------------------------

  const requestBody = {

    systemInstruction: {
      parts: [
        {
          text: SYSTEM_INSTRUCTION
        }
      ]
    },

    contents: [
      {
        role: "user",
        parts: parts
      }
    ],

    // Google Search grounding
    tools: [
      {
        google_search: {}
      }
    ]

  };


  // ----------------------------------------------------------
  // RETRY SYSTEM
  // ----------------------------------------------------------

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt++
  ) {

    try {

      const response = await fetch(

        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,

        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": API_KEY
          },

          body: JSON.stringify(requestBody)
        }

      );


      // ------------------------------------------------------
      // SUCCESS
      // ------------------------------------------------------

      if (response.ok) {

        const data =
          await response.json();


        const candidate =
          data?.candidates?.[0];


        const answer =
          candidate?.content?.parts
            ?.map(
              (part) =>
                part.text || ""
            )
            .join("")
            .trim();


        if (!answer) {

          throw new Error(
            "Gemini returned an empty response."
          );

        }


        return {

          answer: answer,

          groundingMetadata:
            candidate?.groundingMetadata || null

        };

      }


      // ------------------------------------------------------
      // ERROR DATA
      // ------------------------------------------------------

      let errorData = {};

      try {

        errorData =
          await response.json();

      } catch {

        errorData = {};

      }


      const errorMessage =
        errorData?.error?.message ||
        `Gemini API error: ${response.status}`;


      // ------------------------------------------------------
      // RETRYABLE ERRORS
      // ------------------------------------------------------

      const retryable =
        response.status === 408 ||
        response.status === 429 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504;


      if (
        retryable &&
        attempt < MAX_RETRIES
      ) {

        const delay =
          Math.pow(2, attempt) * 1000 +
          Math.floor(
            Math.random() * 500
          );


        console.log(
          `Gemini error ${response.status}. ` +
          `Retrying in ${delay}ms...`
        );


        await sleep(delay);

        continue;
      }


      throw new Error(
        errorMessage
      );

    } catch (error) {

      const message =
        String(
          error?.message || ""
        ).toLowerCase();


      const networkError =
        message.includes("fetch") ||
        message.includes("network") ||
        message.includes("socket") ||
        message.includes("timeout");


      if (
        networkError &&
        attempt < MAX_RETRIES
      ) {

        const delay =
          Math.pow(2, attempt) * 1000 +
          Math.floor(
            Math.random() * 500
          );


        console.log(
          `Network error. Retrying in ${delay}ms...`
        );


        await sleep(delay);

        continue;
      }


      throw error;
    }

  }


  throw new Error(
    "Gemini request failed after multiple retries."
  );
}


// ============================================================
// EXTRACT GOOGLE SEARCH SOURCES
// ============================================================

function extractSources(
  groundingMetadata
) {

  if (!groundingMetadata) {
    return [];
  }


  const chunks =
    groundingMetadata.groundingChunks || [];


  const sources = [];


  for (
    const chunk of chunks
  ) {

    if (
      chunk &&
      chunk.web &&
      chunk.web.uri
    ) {

      sources.push({

        title:
          chunk.web.title ||
          "Web source",

        url:
          chunk.web.uri

      });

    }

  }


  // Remove duplicate URLs
  const uniqueSources = [];

  const seen =
    new Set();


  for (
    const source of sources
  ) {

    if (
      !seen.has(
        source.url
      )
    ) {

      seen.add(
        source.url
      );

      uniqueSources.push(
        source
      );

    }

  }


  return uniqueSources;
}


// ============================================================
// ROOT / STATUS ENDPOINT
// ============================================================

app.get(
  "/",
  (req, res) => {

    res.json({

      name: "Lumora AI Backend",

      status: "online",

      creator:
        "Ankush Mondal",

      provider:
        "Google Gemini API",

      model:
        MODEL,

      googleSearch:
        true,

      imageInput:
        true,

      capabilities: [

        "General AI",

        "Education",

        "Mathematics",

        "Programming",

        "Coding",

        "HTML",

        "CSS",

        "JavaScript",

        "Python",

        "Java",

        "C",

        "C++",

        "PHP",

        "SQL",

        "Node.js",

        "Express.js",

        "Android",

        "Web Development",

        "UI/UX",

        "Databases",

        "API Development",

        "Debugging",

        "Screenshot Analysis",

        "Image Analysis",

        "Phone Troubleshooting",

        "App Troubleshooting",

        "Health Information",

        "Science",

        "History",

        "Geography",

        "Writing",

        "Translation",

        "Business",

        "Career",

        "Social Media",

        "Website Search",

        "Official Link Discovery",

        "Google Search"

      ]

    });

  }
);


// ============================================================
// CHAT ENDPOINT
// ============================================================

app.post(
  "/api/chat",
  async (req, res) => {

    try {

      const {
        message,
        image
      } = req.body;


      // ------------------------------------------------------
      // VALIDATE MESSAGE
      // ------------------------------------------------------

      if (
        !message ||
        typeof message !== "string" ||
        !message.trim()
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Message is required."

        });

      }


      console.log(
        "----------------------------------------------"
      );

      console.log(
        "Lumora user message:"
      );

      console.log(
        message.substring(
          0,
          500
        )
      );


      // ------------------------------------------------------
      // CALL GEMINI
      // ------------------------------------------------------

      const result =
        await callGemini(
          message,
          image || null
        );


      // ------------------------------------------------------
      // GET SEARCH SOURCES
      // ------------------------------------------------------

      const sources =
        extractSources(
          result.groundingMetadata
        );


      console.log(
        "Sources found:",
        sources.length
      );


      // ------------------------------------------------------
      // SEND RESPONSE
      // ------------------------------------------------------

      return res.json({

        success: true,

        reply:
          result.answer,

        sources:
          sources

      });

    } catch (error) {

      console.error(
        "=============================================="
      );

      console.error(
        "LUMORA ERROR:"
      );

      console.error(
        error
      );

      console.error(
        "=============================================="
      );


      return res.status(503).json({

        success: false,

        error:
          "Lumora AI is temporarily unable to complete the request. Please try again shortly.",

        details:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined

      });

    }

  }
);


// ============================================================
// UNKNOWN ROUTE
// ============================================================

app.use(
  (req, res) => {

    res.status(404).json({

      success: false,

      error:
        "Endpoint not found."

    });

  }
);


// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  () => {

    console.log(
      "=============================================="
    );

    console.log(
      `Lumora AI Backend is running on port ${PORT}`
    );

    console.log(
      `Model: ${MODEL}`
    );

    console.log(
      "Google Search: ENABLED"
    );

    console.log(
      "Image/Screenshot Input: ENABLED"
    );

    console.log(
      "Multilingual Script Detection: ENABLED"
    );

    console.log(
      "=============================================="
    );

  }
);
