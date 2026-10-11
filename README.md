# 🧾 Universal Digital Receipt & Warranty Vault

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://frontend-seven-puce-ahpmd3wmmi.vercel.app)
[![API Status](https://img.shields.io/badge/Backend_API-Railway-0B0D0E?style=for-the-badge&logo=railway)](https://backend-production-ef4e.up.railway.app/health)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=for-the-badge&logo=postgresql)](https://railway.app)
[![Redis](https://img.shields.io/badge/Queue-Redis%20%2B%20BullMQ-DC382D?style=for-the-badge&logo=redis)](https://railway.app)

An enterprise-grade, event-driven receipt digitization platform designed for high-throughput, non-blocking receipt scanning, multimodal metadata extraction via Google Gemini AI, and automated deadline tracking for warranties and returns.

---

## 🔗 Live Deployments

- 🌐 **Web Application:** [https://frontend-seven-puce-ahpmd3wmmi.vercel.app](https://frontend-seven-puce-ahpmd3wmmi.vercel.app)
- ⚙️ **Backend API (Health Check):** [https://backend-production-ef4e.up.railway.app/health](https://backend-production-ef4e.up.railway.app/health)
- 📊 **Bull-Board Queue Dashboard:** [https://backend-production-ef4e.up.railway.app/admin/queues](https://backend-production-ef4e.up.railway.app/admin/queues)

---

## 🏗️ Architecture Overview

```text
[ React (Vite) Frontend on Vercel ]
       │
       ├── 1. POST /api/receipts/upload (Multipart Image)
       │    └─► HTTP 202 Accepted & Job ID returned immediately
       │
       ├── 2. GET /api/receipts/events (Server-Sent Events)
       │    └─► Real-time stream (QUEUED -> PROCESSING -> COMPLETED)
       │
       ▼
[ Express API Server on Railway ]
       │
       ▼ (Enqueue Job)
[ Redis + BullMQ Message Broker ]
       │
       ▼ (Asynchronous Worker Pool)
[ Background Worker (src/queue.js) ]
       ├─► 1. Google Gemini 1.5 Flash (Vision OCR & Multimodal Parsing)
       ├─► 2. Zod Runtime Schema Validation & Fallback Sanitization
       ├─► 3. Expiration Calculation (Warranty & Return Windows)
       ├─► 4. Cloud PostgreSQL Persistence (via Prisma ORM)
       └─► 5. Server-Sent Events (SSE) Push to Client Browser
```

---

## ✨ Key Features & Engineering Highlights

- **Decoupled Asynchronous Processing (HTTP 202 Pattern):** Image OCR and LLM analysis take 3–5 seconds. Instead of blocking HTTP connections, the API immediately enqueues the job into Redis with BullMQ and returns `202 Accepted`.
- **Real-Time SSE Stream:** Client receives live pipeline updates through Server-Sent Events (`/api/receipts/events`) without WebSocket connection overhead or polling.
- **Multimodal AI & Defensive Validation:** Utilizes Google Gemini Vision AI to parse complex receipts into structured JSON, validated at runtime with **Zod** schemas to defend against hallucinations.
- **Automated Expiry Alerts:** Daily cron engine (`node-cron` + `nodemailer`) scans expiring warranty and return windows and notifies users ahead of deadlines.
- **Observability:** Protected **Bull-Board** dashboard at `/admin/queues` for monitoring queue latency, retries, and worker health.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite, TailwindCSS, Lucide Icons, Recharts, Axios
- **Backend:** Node.js, Express, Prisma ORM, BullMQ, IORedis, Zod, Nodemailer
- **AI / OCR:** Google Gemini 1.5 Flash (Multimodal Vision API), Tesseract.js fallback
- **Database & Queue:** PostgreSQL (Railway), Redis (Railway)
- **Deployment:** Vercel (Edge CDN Frontend), Railway (Containerized Backend + DB + Cache)
