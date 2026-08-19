/**
 * The Playwright suite (apps/api-tests) legitimately makes far more
 * requests per minute against a shared endpoint than any real user ever
 * would — e.g. every test that needs a teacher calls /auth/register once,
 * and 100+ tests run in parallel from the same machine/IP within seconds.
 * Rate limiting should stay fully active in dev/production; it just needs
 * to get out of the way for automated tests, the same way SMTP/Gemini
 * are explicitly disabled for tests (see playwright.config.ts).
 */
const IS_TEST_ENV = process.env.NODE_ENV === "test";

export function throttleLimit(prodLimit: number): number {
  return IS_TEST_ENV ? 100_000 : prodLimit;
}
