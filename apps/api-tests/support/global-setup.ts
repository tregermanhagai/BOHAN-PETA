import { execSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";
import { TEST_DATABASE_URL } from "./env";

const API_DIR = path.resolve(__dirname, "../../api");
const SCHEMA_PATH = path.join(API_DIR, "prisma/schema.prisma");

async function waitForDb(connectionString: string, attempts = 15): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.end();
      return;
    } catch {
      await client.end().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error(
    `Could not reach the test database at ${connectionString}. ` +
      "Is it running? Try: npm run db:test:up",
  );
}

export default async function globalSetup(): Promise<void> {
  await waitForDb(TEST_DATABASE_URL);

  // Brings a fresh db_test volume up to date; a no-op if already current.
  execSync(`npx prisma migrate deploy --schema "${SCHEMA_PATH}"`, {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });

  // Clean slate for every run, so leftover rows from a previous run
  // (or a previous failed one) can never affect this run's assertions.
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  await client.query(
    'TRUNCATE TABLE "attempt_answer","attempt","quiz_assignment","answer_option",' +
      '"question","quiz_source","quiz_template","cohort","student","teacher" ' +
      "RESTART IDENTITY CASCADE",
  );
  await client.end();
}
