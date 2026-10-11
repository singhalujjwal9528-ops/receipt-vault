// backend/src/queue.js
const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// 1. Prisma Client Import (Uses your centralized DB instance if available)
let prisma;
try {
  prisma = require("./db");
} catch {
  const { PrismaClient } = require("@prisma/client");
  prisma = new PrismaClient();
}

// 2. Redis Connection
const redisOptions = {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    // Exponential backoff with a cap at 5 seconds to prevent spamming the console
    return Math.min(times * 1000, 5000);
  },
};

// Upstash and other cloud Redis providers use rediss:// (TLS). Detect and enable it automatically.
const connection = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, {
      ...redisOptions,
      ...(process.env.REDIS_URL.startsWith("rediss://") ? { tls: {} } : {}),
    })
  : new IORedis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      ...redisOptions,
    });


connection.on("connect", () => {
  console.log("⚡ [Redis] BullMQ connected successfully!");
});

let lastRedisErrorLog = 0;
connection.on("error", (err) => {
  const now = Date.now();
  // Throttle error logging to once every 10 seconds to avoid flooding the console
  if (now - lastRedisErrorLog > 10000) {
    console.error("❌ [Redis] Connection error:", err.message);
    console.error("👉 [Fix] Redis is not running on 127.0.0.1:6379. Start Redis (Docker / Memurai) or configure REDIS_URL in .env");
    lastRedisErrorLog = now;
  }
});

// 3. BullMQ Queue Instance
const receiptQueue = new Queue("receipt-processing", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

// 4. Server-Sent Events (SSE) Client Storage & Dispatcher
// Maps userId -> Set<Response> to support multiple simultaneous browser tabs/devices
const sseClients = new Map();

function notifyUser(userId, payload) {
  const userKey = String(userId);
  const clientSet = sseClients.get(userKey);
  if (clientSet && clientSet.size > 0) {
    const dataStr = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of Array.from(clientSet)) {
      try {
        if (!res.writableEnded && !res.finished) {
          res.write(dataStr);
        } else {
          clientSet.delete(res);
        }
      } catch (err) {
        console.warn(`⚠️ [SSE Write Error] Pruning closed socket for User #${userId}:`, err.message);
        clientSet.delete(res);
      }
    }
    if (clientSet.size === 0) {
      sseClients.delete(userKey);
    }
    console.log(`📡 [SSE Dispatched] User #${userId} (${clientSet.size} active connections) -> ${payload.status}`);
  } else {
    console.log(`⚠️ [SSE Notice] User #${userId} is offline / not connected to SSE.`);
  }
}

// Date helpers for warranty and return window calculations
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + Number(months));
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days));
  return d;
}

// 5. Gemini AI Setup
const ai = new GoogleGenAI(process.env.GEMINI_API_KEY || "");

// 6. BullMQ Background Worker
const receiptWorker = new Worker(
  "receipt-processing",
  async (job) => {
    const { userId, filePath, fileName, mimeType } = job.data;
    console.log(`\n==================================================`);
    console.log(`🔄 [Worker] Processing Job #${job.id} for User #${userId}`);
    console.log(`==================================================`);

    notifyUser(userId, {
      status: "PROCESSING",
      jobId: job.id,
      message: "AI analyzing receipt image...",
    });

    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Receipt image file not found at: ${filePath}`);
      }

      // Read image and encode to Base64 for Gemini Vision
      const imageBuffer = fs.readFileSync(filePath);
      const imagePart = {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType: mimeType || "image/jpeg",
        },
      };

      const prompt = `Analyze this receipt image and return ONLY a single valid JSON object (no markdown, no extra commentary) matching this schema:
      {
        "vendor": "Merchant or store name",
        "amount": 100.50,
        "currency": "INR",
        "purchaseDate": "YYYY-MM-DD",
        "category": "Groceries" | "Electronics" | "Dining" | "Utilities" | "Travel" | "Other",
        "itemDescription": "Summary of purchased goods or service",
        "warrantyMonths": 12,
        "returnWindowDays": 7
      }`;

      console.log(`📤 Sending image to Gemini Vision API...`);

const result = await ai.models.generateContent({
  model: "gemini-3.6-flash",
  contents: [
    { text: prompt },
    imagePart,
  ],
});

const { ReceiptExtractionSchema } = require("./schemas/receiptSchema");

const rawText = result.text.replace(/```json|```/gi, "").trim();
console.log(`📄 Raw AI Output:`, rawText);

      let parsed;
      try {
        const rawJson = JSON.parse(rawText);
        const validation = ReceiptExtractionSchema.safeParse(rawJson);
        if (validation.success) {
          parsed = validation.data;
        } else {
          console.warn("⚠️ [Worker] Zod schema validation warning:", validation.error.issues);
          parsed = ReceiptExtractionSchema.parse(rawJson);
        }
      } catch (jsonErr) {
        console.warn("⚠️ [Worker] JSON parse failed on AI output, applying safe fallback defaults:", jsonErr.message);
        parsed = ReceiptExtractionSchema.parse({});
      }

      // Resolve Dates
      const purchaseDate = parsed.purchaseDate || new Date();

      const warrantyExpiresAt = parsed.warrantyMonths
        ? addMonths(purchaseDate, parsed.warrantyMonths)
        : null;

      const returnExpiresAt = parsed.returnWindowDays
        ? addDays(purchaseDate, parsed.returnWindowDays)
        : null;

      // Save extracted data to database
      console.log(`💾 Saving receipt to database for User #${userId}...`);
      const savedReceipt = await prisma.receipt.create({
        data: {
          userId: String(userId) || userId,
          vendor: parsed.vendor,
          purchaseDate,
          amount: parsed.amount,
          currency: parsed.currency,
          category: parsed.category,
          itemDescription: parsed.itemDescription,
          warrantyExpiresAt,
          returnExpiresAt,
          source: "photo",
          originalFileUrl: fileName ? `/uploads/${fileName}` : null,
          rawText: rawText,
        },
      });

      console.log(`✅ [Worker] Job #${job.id} completed successfully!`);

      // Push real-time completion payload to client browser
      notifyUser(userId, {
        status: "COMPLETED",
        jobId: job.id,
        receipt: savedReceipt,
      });

      return savedReceipt;
    } catch (err) {
      console.error(`❌ [Worker Error] Job #${job.id} failed:`, err);
      notifyUser(userId, {
        status: "FAILED",
        jobId: job.id,
        error: err.message || "Failed to parse receipt with AI.",
      });
      throw err;
    }
  },
  { connection, concurrency: 3 }
);

receiptWorker.on("ready", () => {
  console.log("⚡ BullMQ Worker is active and listening for queued jobs.");
});

receiptWorker.on("failed", (job, err) => {
  console.error(`❌ Job #${job?.id} failed:`, err.message);
});

module.exports = { receiptQueue, sseClients };