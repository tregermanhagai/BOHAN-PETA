import { randomUUID } from "node:crypto";

/**
 * Every test that needs a teacher/cohort generates its own unique data
 * rather than relying on fixture rows, so tests stay independent and
 * safe to run with fullyParallel: true.
 */
export function uniqueEmail(prefix = "qa"): string {
  return `${prefix}-${randomUUID()}@example.test`;
}

export function uniqueCohortName(prefix = "Cohort"): string {
  return `${prefix} ${randomUUID().slice(0, 8)}`;
}
