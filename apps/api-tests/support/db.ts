import { Client } from "pg";
import { TEST_DATABASE_URL } from "./env";

/** Directly rewinds an attempt's started_at, to deterministically test server-side time expiry without waiting real minutes. */
export async function rewindAttemptStartedAt(attemptId: string, minutesAgo: number): Promise<void> {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `UPDATE attempt SET started_at = started_at - ($2 * interval '1 minute') WHERE id = $1`,
      [attemptId, minutesAgo],
    );
  } finally {
    await client.end();
  }
}
