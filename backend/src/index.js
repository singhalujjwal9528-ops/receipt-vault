require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

// 1. Core Services & Routers
const rateLimit = require("express-rate-limit");
const prisma = require("./db");
const receiptsRouter = require("./routes/receipts");
const authRouter = require("./routes/auth");
const requireAuth = require("./middleware/auth");
const { startScheduler, sendExpiryAlerts } = require("./services/scheduler");

// 2. Import Queue, SSE Client Map, & Bull-Board
const { receiptQueue, sseClients } = require("./queue");
const bullBoardRouter = require("./admin/bullBoard");
const adminAuth = require("./middleware/adminAuth");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 4000;

// CORS: allow the deployed frontend URL and local dev. Set CORS_ORIGIN in production.
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:4173"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl) in non-prod
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// 3. Mount Bull-Board Visual Monitoring Dashboard (Secured with Basic Auth)
app.use("/admin/queues", adminAuth, bullBoardRouter);

// 4. Rate Limiting (Security & Resource Protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 30, // 30 requests per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 10, // 10 uploads per min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Upload rate limit exceeded. Please wait a moment before uploading more receipts." },
});

// 5. Deep Health Check Endpoint
app.get("/health", async (req, res) => {
  let dbStatus = "UP";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = "DOWN: " + err.message;
  }

  let redisStatus = "UP";
  try {
    const client = await receiptQueue.client;
    redisStatus = client && (client.status === "ready" || client.status === "connect") ? "UP" : (client?.status || "UNKNOWN");
  } catch (err) {
    redisStatus = "DOWN: " + err.message;
  }

  const isHealthy = dbStatus === "UP";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "degraded",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
    dashboards: {
      queues: "/admin/queues",
    },
  });
});

// 6. Real-Time Server-Sent Events (SSE) Route (Protected by JWT)
app.get("/api/receipts/events", (req, res) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  const token = bearerToken || req.query.token;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized. JWT token required (as ?token= or Authorization header)." });
  }

  let authenticatedUserId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    authenticatedUserId = String(decoded.userId);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token for live stream." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  if (!sseClients.has(authenticatedUserId)) {
    sseClients.set(authenticatedUserId, new Set());
  }
  const clientSet = sseClients.get(authenticatedUserId);
  clientSet.add(res);

  console.log(`📡 [SSE Connected] User #${authenticatedUserId} connected (Active connections: ${clientSet.size})`);

  // Initial connection confirmation
  res.write(`data: ${JSON.stringify({ status: "CONNECTED", message: "SSE stream established" })}\n\n`);

  // 25-second keep-alive ping to prevent proxy/browser timeout
  const keepAlive = setInterval(() => {
    try {
      if (!res.writableEnded && !res.finished) {
        res.write(": ping\n\n");
      }
    } catch {
      clearInterval(keepAlive);
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    const set = sseClients.get(authenticatedUserId);
    if (set) {
      set.delete(res);
      if (set.size === 0) {
        sseClients.delete(authenticatedUserId);
      }
    }
    console.log(`🔌 [SSE Disconnected] User #${authenticatedUserId}`);
    res.end();
  });
});

// 7. Auth routes (with rate limiter)
app.use("/api/auth", authLimiter, authRouter);

// 8. Test email route (protected — requires valid JWT)
app.post("/api/test-email", requireAuth, async (req, res) => {
  try {
    await sendExpiryAlerts();
    res.json({ message: "Expiry scanner executed successfully!" });
  } catch (err) {
    console.error("[Test Email Error]:", err);
    res.status(500).json({ error: err.message });
  }
});

// 9. Receipts routes (protected + upload rate limiting)
app.use("/api/receipts/upload", uploadLimiter);
app.use("/api/receipts", requireAuth, receiptsRouter);

// 10. Robust Error Handling Middleware
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith("Invalid file type")) {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File size limit exceeded (Max 10MB)" });
  }
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Unexpected server error", details: err.message });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Receipt manager backend running on http://localhost:${PORT}`);
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      startScheduler();
    } else {
      console.log("[scheduler] SMTP not configured, skipping reminder scheduler");
    }
  });
}

module.exports = app;