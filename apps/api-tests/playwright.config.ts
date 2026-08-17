import { defineConfig } from "@playwright/test";
import path from "node:path";
import { API_BASE_URL, API_TEST_PORT, TEST_DATABASE_URL, TEST_JWT_SECRET } from "./support/env";

const REPO_ROOT = path.resolve(__dirname, "../..");

export default defineConfig({
  testDir: "./tests",
  globalSetup: require.resolve("./support/global-setup"),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 15_000,

  use: {
    baseURL: API_BASE_URL,
    extraHTTPHeaders: { "Content-Type": "application/json" },
  },

  // Boots a second API instance, pointed at db_test on port 5433, so it
  // never shares state with the dev server on :3000 / db on :5432.
  //
  // Deliberately NOT `nest start --watch`: that compiles into
  // apps/api/dist, the same folder the dev server's own watch process
  // writes to — running both at once (a very normal thing to do; the
  // dev server is meant to keep running while you test) causes each
  // one's `deleteOutDir` to blow away the other's output mid-write.
  // A one-off `tsc` build into a dedicated dist-test/ directory sidesteps
  // that entirely.
  webServer: {
    command:
      "npx tsc -p apps/api/tsconfig.test-server.json && node apps/api/dist-test/main.js",
    cwd: REPO_ROOT,
    url: `${API_BASE_URL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: TEST_JWT_SECRET,
      JWT_EXPIRES_IN: "1h",
      PORT: API_TEST_PORT,
      // Explicitly blanked, not just omitted: tests join real-looking but
      // fake @example.test addresses on every run, and MailService no-ops
      // when these are empty. Leaving them unset would let this server
      // fall through to whatever's ambient in the parent shell/.env,
      // which would fire real sends to fake addresses and bounce into a
      // real inbox — this override makes that structurally impossible.
      SMTP_USER: "",
      SMTP_APP_PASSWORD: "",
      // Same reasoning: a real key here would let the AI-generation tests
      // (or any future one exercising that route) trigger real, billed
      // Gemini calls — GeminiService treats a blank key as "unconfigured"
      // and fails the request cleanly instead.
      GEMINI_API_KEY: "",
    },
  },
});
