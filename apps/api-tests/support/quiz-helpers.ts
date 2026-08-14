import type { APIRequestContext } from "@playwright/test";
import type { QuestionResponse, QuizTemplateResponse, UpsertQuestionRequest } from "@bohan-peta/shared-types";

type Headers = Record<string, string>;

/** Bearer header for a teacher's token, for tests using the shared (unauthenticated) `request` fixture across two teachers. */
export function authHeader(token: string): Headers {
  return { Authorization: `Bearer ${token}` };
}

export async function createDraftQuiz(
  request: APIRequestContext,
  title = "QA Quiz",
  headers?: Headers,
): Promise<QuizTemplateResponse> {
  const res = await request.post("/quiz-templates", { data: { title, language: "en" }, headers });
  return res.json();
}

const VALID_SINGLE_QUESTION: UpsertQuestionRequest = {
  text: "What is 2 + 2?",
  type: "single",
  options: [
    { text: "3", isCorrect: false },
    { text: "4", isCorrect: true },
  ],
};

export async function addQuestion(
  request: APIRequestContext,
  quizId: string,
  overrides: Partial<UpsertQuestionRequest> = {},
  headers?: Headers,
): Promise<QuestionResponse> {
  const res = await request.post(`/quiz-templates/${quizId}/questions`, {
    data: { ...VALID_SINGLE_QUESTION, ...overrides },
    headers,
  });
  return res.json();
}

/** Creates a draft quiz, adds 3 valid questions, and publishes it. */
export async function createPublishedQuiz(
  request: APIRequestContext,
  title = "QA Published Quiz",
  headers?: Headers,
): Promise<QuizTemplateResponse> {
  const quiz = await createDraftQuiz(request, title, headers);
  for (let i = 0; i < 3; i++) {
    await addQuestion(request, quiz.id, { text: `Question ${i + 1}?` }, headers);
  }
  const res = await request.patch(`/quiz-templates/${quiz.id}/status`, {
    data: { status: "published" },
    headers,
  });
  return res.json();
}
