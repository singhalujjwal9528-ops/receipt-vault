const request = require("supertest");
const app = require("../src/index");
const prisma = require("../src/db");
const { receiptQueue } = require("../src/queue");

describe("System Health & Security Endpoints", () => {
  afterAll(async () => {
    try {
      await prisma.$disconnect();
      await receiptQueue.close();
    } catch {
      // Ignore disconnect cleanup
    }
  });

  test("GET /health - responds with structured health metrics", async () => {
    const res = await request(app).get("/health");

    // Endpoint may return 200 or 503 depending on local redis status, but structure must match
    expect([200, 503]).toContain(res.statusCode);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("uptimeSeconds");
    expect(res.body).toHaveProperty("services");
    expect(res.body.services).toHaveProperty("database");
    expect(res.body.services).toHaveProperty("redis");
  });

  test("GET /admin/queues - rejects unauthenticated access (401)", async () => {
    const res = await request(app).get("/admin/queues");
    expect(res.statusCode).toBe(401);
  });

  test("GET /admin/queues - allows access with valid Basic Auth credentials", async () => {
    const credentials = Buffer.from("admin:admin123").toString("base64");
    const res = await request(app)
      .get("/admin/queues")
      .set("Authorization", `Basic ${credentials}`);

    // Expect redirect (302/301) to /admin/queues/ or 200 OK
    expect([200, 301, 302]).toContain(res.statusCode);
  });

  test("GET /api/receipts/events - rejects SSE connection without token (401)", async () => {
    const res = await request(app).get("/api/receipts/events");
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/JWT token required/i);
  });
});
