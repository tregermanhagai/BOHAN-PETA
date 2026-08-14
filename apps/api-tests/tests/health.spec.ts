import { test, expect } from "@playwright/test";

test("GET /health reports ok and a connected database", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.db).toBe("connected");
  expect(new Date(body.time).toString()).not.toBe("Invalid Date");
});
