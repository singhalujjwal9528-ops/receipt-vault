const request = require("supertest");
const app = require("../src/index");
const prisma = require("../src/db");

describe("Authentication API", () => {
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = "securePassword123";

  afterAll(async () => {
    // Cleanup created test user
    try {
      await prisma.user.deleteMany({
        where: { email: { contains: "test_" } },
      });
      await prisma.$disconnect();
    } catch {
      // Ignore disconnect errors
    }
  });

  test("POST /api/auth/signup - rejects invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "invalid-email", password: "password123" });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Invalid email address format/i);
  });

  test("POST /api/auth/signup - rejects passwords under 6 characters", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "valid@example.com", password: "123" });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/at least 6 characters/i);
  });

  test("POST /api/auth/signup - creates user and returns JWT token", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: testEmail, password: testPassword, name: "Test User" });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.email).toBe(testEmail.toLowerCase());
  });

  test("POST /api/auth/signup - prevents duplicate email registration", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: testEmail, password: testPassword });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Email already registered/i);
  });

  test("POST /api/auth/login - authenticates user with correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: testPassword });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.email).toBe(testEmail.toLowerCase());
  });

  test("POST /api/auth/login - rejects wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: "wrongPassword" });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Invalid email or password/i);
  });
});
