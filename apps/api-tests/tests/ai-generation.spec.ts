import { test, expect } from "../support/fixtures";
import { uniqueEmail } from "../support/test-data";
import { authHeader, createDraftQuiz } from "../support/quiz-helpers";

/**
 * Only covers what fails before ever calling Gemini: auth, ownership, and
 * DTO validation all short-circuit ahead of the actual API call. There's
 * deliberately no test here that exercises a real generation — that needs
 * a live GEMINI_API_KEY, costs real money per run, and isn't
 * deterministic, so it's not appropriate for an automated suite.
 */
test.describe("POST /quiz-templates/:id/generate", () => {
  test("rejects an unauthenticated request with 401", async ({ authedRequest, request }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await request.post(`/quiz-templates/${quiz.id}/generate`, {
      data: { topic: "QA in Scrum", questionCount: 5, optionsPerQuestion: 4, questionType: "single" },
    });
    expect(res.status()).toBe(401);
  });

  test("404s for a quiz you don't own", async ({ authedRequest, request }) => {
    const otherEmail = uniqueEmail("other");
    const otherRegister = await request.post("/auth/register", {
      data: { name: "Owner", email: otherEmail, password: "correct-horse-battery-staple" },
    });
    const { accessToken: otherToken } = await otherRegister.json();
    const otherQuiz = await createDraftQuiz(request, "Other's Quiz", authHeader(otherToken));

    const res = await authedRequest.post(`/quiz-templates/${otherQuiz.id}/generate`, {
      data: { topic: "QA in Scrum", questionCount: 5, optionsPerQuestion: 4, questionType: "single" },
    });
    expect(res.status()).toBe(404);
  });

  test("rejects a question count outside 3-20 (F-11)", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.post(`/quiz-templates/${quiz.id}/generate`, {
      data: { topic: "QA in Scrum", questionCount: 2, optionsPerQuestion: 4, questionType: "single" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects an options-per-question count outside 2-6 (F-11)", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.post(`/quiz-templates/${quiz.id}/generate`, {
      data: { topic: "QA in Scrum", questionCount: 5, optionsPerQuestion: 7, questionType: "single" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects an invalid questionType", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.post(`/quiz-templates/${quiz.id}/generate`, {
      data: { topic: "QA in Scrum", questionCount: 5, optionsPerQuestion: 4, questionType: "essay" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects when neither a topic nor a source file is provided", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.post(`/quiz-templates/${quiz.id}/generate`, {
      data: { questionCount: 5, optionsPerQuestion: 4, questionType: "single" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects a source file that isn't PDF or DOCX (F-10)", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.post(`/quiz-templates/${quiz.id}/generate`, {
      multipart: {
        questionCount: "5",
        optionsPerQuestion: "4",
        questionType: "single",
        file: {
          name: "notes.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("plain text, not a real source document"),
        },
      },
    });
    expect(res.status()).toBe(400);
  });

  test("validates numeric bounds when fields arrive as multipart strings, not just JSON", async ({
    authedRequest,
  }) => {
    // The UI always submits via multipart (so the file field, when
    // present, works) — multipart fields are always strings ("2", not 2),
    // so this proves the DTO's @Type(() => Number) coercion runs before
    // validation over this path too, not just for JSON bodies.
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.post(`/quiz-templates/${quiz.id}/generate`, {
      multipart: { topic: "QA in Scrum", questionCount: "2", optionsPerQuestion: "4", questionType: "single" },
    });
    expect(res.status()).toBe(400);
  });
});
