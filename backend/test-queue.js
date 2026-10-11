// backend/test-queue.js
require("dotenv").config();
const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");

const connection = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
  : new IORedis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null,
    });

const testQueue = new Queue("test-queue", { connection });

const worker = new Worker(
  "test-queue",
  async (job) => {
    console.log(`\n✅ Background Worker received job #${job.id} with data:`, job.data);
    return { status: "success" };
  },
  { connection }
);

async function runTest() {
  console.log("Adding job to BullMQ queue...");
  await testQueue.add("sample-receipt", {
    userId: 1,
    testMessage: "OCR Pipeline Test",
  });
}

runTest();