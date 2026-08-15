import type { APIRequestContext } from "@playwright/test";
import type {
  CohortResponse,
  CreateQuizAssignmentRequest,
  JoinAttemptRequest,
  JoinAttemptResponse,
  QuizAssignmentResponse,
  QuizTemplateResponse,
} from "@bohan-peta/shared-types";
import { uniqueCohortName } from "./test-data";

/** Same checksum as apps/api/src/students/national-id.util.ts. */
function isValidIsraeliNationalId(rawId: string): boolean {
  const cleaned = rawId.replace(/\D/g, "");
  if (cleaned.length === 0 || cleaned.length > 9) return false;
  const padded = cleaned.padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = Number(padded[i]) * ((i % 2) + 1);
    if (digit > 9) digit -= 9;
    sum += digit;
  }
  return sum % 10 === 0;
}

export function uniqueValidNationalId(): string {
  const base = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
  for (let check = 0; check < 10; check++) {
    const candidate = base + check;
    if (isValidIsraeliNationalId(candidate)) return candidate;
  }
  throw new Error("unreachable — one of 0-9 always satisfies the checksum");
}

export async function createCohort(
  request: APIRequestContext,
  name?: string,
  headers?: Record<string, string>,
): Promise<CohortResponse> {
  const res = await request.post("/cohorts", { data: { name: name ?? uniqueCohortName() }, headers });
  return res.json();
}

export async function createAssignment(
  request: APIRequestContext,
  cohortId: string,
  overrides: CreateQuizAssignmentRequest,
  headers?: Record<string, string>,
): Promise<QuizAssignmentResponse> {
  const res = await request.post(`/cohorts/${cohortId}/assignments`, { data: overrides, headers });
  return res.json();
}

export interface ExamReadyFixture {
  quiz: QuizTemplateResponse;
  cohort: CohortResponse;
  assignment: QuizAssignmentResponse;
  /** [questionId, [optionId, isCorrect][]][], in the order the questions were authored. */
  questions: { id: string; options: { id: string; text: string; isCorrect: boolean }[] }[];
}

/**
 * A fully published, assigned quiz with known question/option content:
 * Q1 (single, correct=B), Q2 (multi, correct={A,C}), Q3 (single, correct=A).
 * Exact ids are returned so tests can submit precise (in)correct answers.
 */
export async function setUpExamReadyQuiz(
  authedRequest: APIRequestContext,
  opts: { maxAttempts?: number; shuffle?: boolean; revealAnswerKey?: boolean } = {},
): Promise<ExamReadyFixture> {
  const quiz = await (await authedRequest.post("/quiz-templates", { data: { title: "Exam Flow Quiz" } })).json();

  const q1 = await (
    await authedRequest.post(`/quiz-templates/${quiz.id}/questions`, {
      data: {
        text: "Q1",
        type: "single",
        options: [
          { text: "A", isCorrect: false },
          { text: "B", isCorrect: true },
        ],
      },
    })
  ).json();
  const q2 = await (
    await authedRequest.post(`/quiz-templates/${quiz.id}/questions`, {
      data: {
        text: "Q2",
        type: "multi",
        options: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: false },
          { text: "C", isCorrect: true },
        ],
      },
    })
  ).json();
  const q3 = await (
    await authedRequest.post(`/quiz-templates/${quiz.id}/questions`, {
      data: {
        text: "Q3",
        type: "single",
        options: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: false },
        ],
      },
    })
  ).json();

  if (opts.revealAnswerKey) {
    await authedRequest.patch(`/quiz-templates/${quiz.id}/grading`, { data: { revealAnswerKey: true } });
  }
  const published = await (
    await authedRequest.patch(`/quiz-templates/${quiz.id}/status`, { data: { status: "published" } })
  ).json();

  const cohort = await createCohort(authedRequest);
  const assignment = await createAssignment(authedRequest, cohort.id, {
    quizTemplateId: quiz.id,
    maxAttempts: opts.maxAttempts ?? 1,
    shuffle: opts.shuffle ?? false,
  });

  return { quiz: published, cohort, assignment, questions: [q1, q2, q3] };
}

export async function joinAttempt(
  request: APIRequestContext,
  overrides: Partial<JoinAttemptRequest> & { accessCode: string },
): Promise<JoinAttemptResponse> {
  const body: JoinAttemptRequest = {
    firstName: "QA",
    lastName: "Student",
    nationalId: uniqueValidNationalId(),
    ...overrides,
  };
  const res = await request.post("/assignments/join", { data: body });
  if (!res.ok()) {
    throw new Error(`join failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}
