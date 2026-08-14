export const API_TEST_PORT = process.env.API_TEST_PORT ?? "3001";
export const API_BASE_URL = `http://localhost:${API_TEST_PORT}`;

// A container of its own (docker-compose db_test), not just a second
// database on the dev instance — so wiping it can never touch dev data.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://bohanpeta:bohanpeta@localhost:5433/bohanpeta_test?schema=public";

export const TEST_JWT_SECRET = "playwright-test-secret-do-not-use-in-prod";
