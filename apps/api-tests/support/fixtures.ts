import { test as base, expect, type APIRequestContext } from "@playwright/test";
import type { AuthResponse } from "@bohan-peta/shared-types";
import { uniqueEmail } from "./test-data";

export interface TestTeacher {
  id: string;
  name: string;
  email: string;
  password: string;
  token: string;
}

interface Fixtures {
  /** A freshly registered teacher, unique per test. */
  teacher: TestTeacher;
  /** An APIRequestContext with that teacher's bearer token already attached. */
  authedRequest: APIRequestContext;
}

export const test = base.extend<Fixtures>({
  teacher: async ({ request }, use) => {
    const email = uniqueEmail();
    const password = "correct-horse-battery-staple";

    const res = await request.post("/auth/register", {
      data: { name: "QA Teacher", email, password },
    });
    expect(res.ok(), `teacher fixture registration failed: ${res.status()} ${await res.text()}`).toBeTruthy();
    const body = (await res.json()) as AuthResponse;

    await use({ id: body.teacher.id, name: body.teacher.name, email, password, token: body.accessToken });
  },

  authedRequest: async ({ playwright, baseURL, teacher }, use) => {
    const context = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${teacher.token}`,
      },
    });
    await use(context);
    await context.dispose();
  },
});

export { expect };
