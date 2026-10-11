# 🧾 Universal Digital Receipt & Warranty Manager — Backend

An enterprise-grade, event-driven Node.js backend designed for high-throughput, non-blocking receipt digitization, automated metadata extraction via Multimodal Vision AI, and deadline tracking for warranties and returns.

---

## 🏗️ System Architecture

```text
[ Client / Web App ]
       │
       ├── 1. POST /api/receipts/upload (Multi-part image)
       │    └─► Responds immediately with HTTP 202 Accepted & Job ID
       │
       ├── 2. GET /api/receipts/events?userId=... (Server-Sent Events)
       │    └─► Listens for live job pipeline events (PROCESSING -> COMPLETED -> FAILED)
       │
       ▼
[ Express API Server ]
       │ (Enqueues Job)
       ▼
[ Redis + BullMQ Message Broker ]
       │
       ▼ (Asynchronous Worker Pool)
[ Background Worker (src/queue.js) ]
       │
       ├─► 1. Google Gemini 3.6 Flash (Vision Multimodal API)
       ├─► 2. Zod Schema Validation & Fallback Sanitization
       ├─► 3. Expiration Calculation (Warranty & Return Windows)
       ├─► 4. Prisma ORM Persistence (User-Isolated Records)
       └─► 5. Server-Sent Events (SSE) Push to Client Browser
```

---

## 🌟 Key Architecture Highlights for Technical Interviews

1. **Decoupled Asynchronous Processing (HTTP 202 Pattern)**
   - Uploading and analyzing an image with an LLM can take 3–6 seconds. Holding an HTTP connection open is an anti-pattern.
   - The endpoint queues the job in Redis and returns **HTTP 202 Accepted** immediately, keeping API throughput high and preventing client timeouts.
2. **Observability with Bull-Board Dashboard**
   - Live visual queue monitoring at `http://localhost:4000/admin/queues`.
   - Inspect active jobs, waiting queues, completed tasks, latency metrics, and error stack traces visually.
3. **Runtime Schema Guarantees with Zod**
   - Because LLM vision outputs can occasionally fluctuate, all extracted JSON passes through a strict `ReceiptExtractionSchema` (`src/schemas/receiptSchema.js`) with resilient fallbacks before touching the database.
4. **Real-Time Client Updates via SSE**
   - Uses Server-Sent Events (`/api/receipts/events`) to stream progress back to the user without polling overhead.
5. **Automated Cron Alert Engine**
   - Daily scheduler (`node-cron` + `nodemailer`) scans expiring warranties and returns, automatically sending alerts before deadlines close.
6. **Analytics & Aggregation Engine**
   - Dedicated `GET /api/receipts/analytics` calculates monthly spending trends, category distributions, and upcoming warranty expiries.
7. **Security & Rate Limiting**
   - `express-rate-limit` guards against brute-force attacks and protects Gemini API quota.
   - Multer file-type validation restricts uploads strictly to safe images (JPG, PNG, WEBP, HEIC, PDF).

---

## 🚀 Quick Start

### 1. Start Redis Infrastructure
Using Docker:
```bash
docker compose up -d
```
*Or using native Docker command:*
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

### 2. Configure Environment
Verify `.env` has your Gemini API key and credentials:
```env
PORT=4000
DATABASE_URL="file:./dev.db"
GEMINI_API_KEY="your-gemini-api-key"
JWT_SECRET="your-jwt-secret"
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379
```

### 3. Run Database Migrations
```bash
npx prisma generate
npx prisma db push
```

### 4. Start the Server
```bash
npm run dev
```

---

## 🧭 Live Endpoints & Dashboards

| Route | Method | Auth | Description |
|---|---|---|---|
| `/admin/queues` | `GET` | Basic Auth | **Bull-Board visual queue monitoring dashboard** |
| `/health` | `GET` | Public | Deep health check (Database & Redis status) |
| `/api/auth/signup` | `POST` | Public | User registration (Bcrypt hash + JWT) |
| `/api/auth/login` | `POST` | Public | User login (returns Bearer JWT) |
| `/api/receipts/events` | `GET` | Token Auth | Server-Sent Events (SSE) live pipeline feed (?token=...) |
| `/api/receipts/upload` | `POST` | Bearer | Non-blocking receipt upload (Returns 202) |
| `/api/receipts/from-text` | `POST` | Bearer | Direct text/email receipt extraction |
| `/api/receipts/analytics` | `GET` | Bearer | Category breakdown, spending trends, & deadlines |
| `/api/receipts` | `GET` | Bearer | Search, filter, and list user receipts |
| `/api/receipts/:id` | `DELETE` | Bearer | Delete receipt (Unlinks physical upload file) |
| `/api/test-email` | `POST` | Public | Trigger test deadline scan & reminder email |

---

## 🧪 Automated Testing Suite

Run all automated unit and integration tests:
```bash
npm test
```
*Covers health diagnostics, authentication validation, duplicate prevention, password strength, Zod schema sanitization, and endpoint security.*

---

## 🎙️ Sample Interview Talking Points

- **Why BullMQ + Redis over in-memory queues?**
  *"In-memory queues lose all state if the Node process restarts or crashes. Redis provides persistent, distributed queues with built-in retry backoff, concurrency controls, and multi-worker scalability."*
- **Why SSE instead of WebSockets?**
  *"The receipt processing flow is unidirectional: the server updates the client on background job status. SSE operates over standard HTTP, natively handles automatic reconnection, is lighter on connection state, and avoids WebSocket upgrade complexity."*
- **How did you handle LLM output unpredictability?**
  *"I integrated Zod to enforce schema guarantees and sane defaults at runtime. If Gemini hallucinates or misses a field like return days or currency, Zod catches it and sanitizes the data before it reaches Prisma."*
