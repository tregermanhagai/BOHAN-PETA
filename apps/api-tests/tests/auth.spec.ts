import { test, expect } from "../support/fixtures";
import { uniqueEmail } from "../support/test-data";

test.describe("POST /auth/register", () => {
  test("creates a teacher and returns a usable token", async ({ request }) => {
    const email = uniqueEmail();
    const res = await request.post("/auth/register", {
      data: { name: "Ada Lovelace", email, password: "correct-horse-battery-staple" },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.teacher).toMatchObject({ name: "Ada Lovelace", email });
    expect(body.teacher.id).toEqual(expect.any(String));
    // The password/hash must never be echoed back.
    expect(body.teacher).not.toHaveProperty("password");
    expect(body.teacher).not.toHaveProperty("passwordHash");
  });

  test("rejects a duplicate email with 409", async ({ request }) => {
    const email = uniqueEmail();
    const payload = { name: "Grace Hopper", email, password: "correct-horse-battery-staple" };

    const first = await request.post("/auth/register", { data: payload });
    expect(first.status()).toBe(201);

    const second = await request.post("/auth/register", { data: payload });
    expect(second.status()).toBe(409);
  });

  test("rejects an invalid email format with 400", async ({ request }) => {
    const res = await request.post("/auth/register", {
      data: { name: "Bad Email", email: "not-an-email", password: "correct-horse-battery-staple" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects a password under 8 characters with 400", async ({ request }) => {
    const res = await request.post("/auth/register", {
      data: { name: "Short Password", email: uniqueEmail(), password: "short" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects a missing name with 400", async ({ request }) => {
    const res = await request.post("/auth/register", {
      data: { email: uniqueEmail(), password: "correct-horse-battery-staple" },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("POST /auth/login", () => {
  test("logs in with correct credentials", async ({ request }) => {
    const email = uniqueEmail();
    const password = "correct-horse-battery-staple";
    await request.post("/auth/register", { data: { name: "Login Test", email, password } });

    const res = await request.post("/auth/login", { data: { email, password } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.teacher.email).toBe(email);
  });

  test("rejects the wrong password with 401", async ({ request }) => {
    const email = uniqueEmail();
    await request.post("/auth/register", {
      data: { name: "Wrong Password", email, password: "correct-horse-battery-staple" },
    });

    const res = await request.post("/auth/login", { data: { email, password: "totally-wrong" } });
    expect(res.status()).toBe(401);
  });

  test("rejects an email that was never registered with 401", async ({ request }) => {
    const res = await request.post("/auth/login", {
      data: { email: uniqueEmail("ghost"), password: "correct-horse-battery-staple" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("JWT guard", () => {
  test("rejects protected routes with no token", async ({ request }) => {
    const res = await request.get("/cohorts");
    expect(res.status()).toBe(401);
  });

  test("rejects protected routes with a garbage token", async ({ request }) => {
    const res = await request.get("/cohorts", {
      headers: { Authorization: "Bearer not-a-real-token" },
    });
    expect(res.status()).toBe(401);
  });

  test("accepts a valid token from register", async ({ request }) => {
    const email = uniqueEmail();
    const registerRes = await request.post("/auth/register", {
      data: { name: "Token Owner", email, password: "correct-horse-battery-staple" },
    });
    const { accessToken } = await registerRes.json();

    const res = await request.get("/cohorts", { headers: { Authorization: `Bearer ${accessToken}` } });
    expect(res.status()).toBe(200);
  });
});
