import { test, expect } from "../support/fixtures";
import { uniqueEmail } from "../support/test-data";
import { addQuestion, authHeader, createDraftQuiz, createPublishedQuiz } from "../support/quiz-helpers";
import { createAssignment, createCohort, joinAttempt } from "../support/attempt-helpers";

test.describe("POST /quiz-templates", () => {
  test("creates a draft quiz with sane defaults", async ({ authedRequest, teacher }) => {
    const res = await authedRequest.post("/quiz-templates", { data: { title: "New Quiz" } });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      title: "New Quiz",
      teacherId: teacher.id,
      status: "draft",
      durationMinutes: 30,
      passScore: 60,
      revealAnswerKey: false,
      questions: [],
    });
  });

  test("rejects a missing title with 400", async ({ authedRequest }) => {
    const res = await authedRequest.post("/quiz-templates", { data: {} });
    expect(res.status()).toBe(400);
  });
});

test.describe("GET /quiz-templates", () => {
  test("lists only the calling teacher's quizzes", async ({ authedRequest, teacher, request }) => {
    const mine = await createDraftQuiz(authedRequest, "Mine");

    const otherEmail = uniqueEmail("other");
    const otherRegister = await request.post("/auth/register", {
      data: { name: "Other Teacher", email: otherEmail, password: "correct-horse-battery-staple" },
    });
    const { accessToken: otherToken } = await otherRegister.json();
    await request.post("/quiz-templates", {
      data: { title: "NotMine" },
      headers: { Authorization: `Bearer ${otherToken}` },
    });

    const res = await authedRequest.get("/quiz-templates");
    const quizzes = await res.json();
    expect(quizzes.every((q: { teacherId: string }) => q.teacherId === teacher.id)).toBe(true);
    expect(quizzes.some((q: { id: string }) => q.id === mine.id)).toBe(true);
  });

  test("includes an accurate active question count", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    await addQuestion(authedRequest, quiz.id);
    await addQuestion(authedRequest, quiz.id);

    const res = await authedRequest.get("/quiz-templates");
    const quizzes = await res.json();
    const mine = quizzes.find((q: { id: string }) => q.id === quiz.id);
    expect(mine.questionCount).toBe(2);
  });
});

test.describe("GET /quiz-templates/:id", () => {
  test("404s for a quiz you don't own", async ({ authedRequest, request }) => {
    const otherEmail = uniqueEmail("other");
    const otherRegister = await request.post("/auth/register", {
      data: { name: "Owner", email: otherEmail, password: "correct-horse-battery-staple" },
    });
    const { accessToken: otherToken } = await otherRegister.json();
    const otherContext = request;
    const otherQuiz = await (
      await otherContext.post("/quiz-templates", {
        data: { title: "Not yours" },
        headers: { Authorization: `Bearer ${otherToken}` },
      })
    ).json();

    const res = await authedRequest.get(`/quiz-templates/${otherQuiz.id}`);
    expect(res.status()).toBe(404);
  });

  test("404s for a nonexistent id", async ({ authedRequest }) => {
    const res = await authedRequest.get("/quiz-templates/00000000-0000-0000-0000-000000000000");
    expect(res.status()).toBe(404);
  });
});

test.describe("PATCH /quiz-templates/:id and /grading", () => {
  test("updates title/language/difficulty", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.patch(`/quiz-templates/${quiz.id}`, {
      data: { title: "Renamed", language: "he", difficulty: "hard" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ title: "Renamed", language: "he", difficulty: "hard" });
  });

  test("updates grading settings independent of status (3.7)", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.patch(`/quiz-templates/${quiz.id}/grading`, {
      data: {
        durationMinutes: 20,
        passScore: 75,
        passFeedbackText: "Well done",
        failFeedbackText: "Try again",
        revealAnswerKey: true,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      durationMinutes: 20,
      passScore: 75,
      passFeedbackText: "Well done",
      failFeedbackText: "Try again",
      revealAnswerKey: true,
    });
  });
});

test.describe("Question authoring (F-11/F-13/F-14)", () => {
  test("adds a valid single-choice question", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.post(`/quiz-templates/${quiz.id}/questions`, {
      data: {
        text: "Capital of France?",
        type: "single",
        options: [
          { text: "Paris", isCorrect: true },
          { text: "Lyon", isCorrect: false },
        ],
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.options).toHaveLength(2);
  });

  test("adds a valid multi-select question with several correct options", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.post(`/quiz-templates/${quiz.id}/questions`, {
      data: {
        text: "Which are primary colors?",
        type: "multi",
        options: [
          { text: "Red", isCorrect: true },
          { text: "Green", isCorrect: false },
          { text: "Blue", isCorrect: true },
        ],
      },
    });
    expect(res.status()).toBe(201);
  });

  test("rejects a Single Choice question with two correct options", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.post(`/quiz-templates/${quiz.id}/questions`, {
      data: {
        text: "Bad",
        type: "single",
        options: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: true },
        ],
      },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects a question with no correct option", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.post(`/quiz-templates/${quiz.id}/questions`, {
      data: {
        text: "Bad",
        type: "multi",
        options: [
          { text: "A", isCorrect: false },
          { text: "B", isCorrect: false },
        ],
      },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects fewer than 2 options (F-11)", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.post(`/quiz-templates/${quiz.id}/questions`, {
      data: { text: "Bad", type: "single", options: [{ text: "Only one", isCorrect: true }] },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects more than 6 options (F-11)", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const options = Array.from({ length: 7 }, (_, i) => ({ text: `Option ${i}`, isCorrect: i === 0 }));
    const res = await authedRequest.post(`/quiz-templates/${quiz.id}/questions`, {
      data: { text: "Bad", type: "single", options },
    });
    expect(res.status()).toBe(400);
  });

  test("edits a question, replacing its options", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const question = await addQuestion(authedRequest, quiz.id);

    const res = await authedRequest.patch(`/quiz-templates/${quiz.id}/questions/${question.id}`, {
      data: {
        text: "Edited?",
        type: "multi",
        options: [
          { text: "X", isCorrect: true },
          { text: "Y", isCorrect: true },
          { text: "Z", isCorrect: false },
        ],
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("Edited?");
    expect(body.options).toHaveLength(3);
  });

  test("deletes a question", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const question = await addQuestion(authedRequest, quiz.id);

    const del = await authedRequest.delete(`/quiz-templates/${quiz.id}/questions/${question.id}`);
    expect(del.status()).toBe(204);

    const fetched = await (await authedRequest.get(`/quiz-templates/${quiz.id}`)).json();
    expect(fetched.questions.find((q: { id: string }) => q.id === question.id)).toBeUndefined();
  });
});

test.describe("Open question authoring", () => {
  test("creates an open question without options", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.post(`/quiz-templates/${quiz.id}/questions`, {
      data: {
        text: "Explain the water cycle.",
        type: "open",
        options: [],
        referenceAnswer: "Evaporation, condensation, precipitation, collection.",
        points: 5,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.options).toHaveLength(0);
    expect(body.referenceAnswer).toBe("Evaporation, condensation, precipitation, collection.");
    expect(body.points).toBe(5);
  });

  test("rejects an open question missing a reference answer", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.post(`/quiz-templates/${quiz.id}/questions`, {
      data: { text: "Bad", type: "open", options: [], points: 5 },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects an open question with fewer than 1 point", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.post(`/quiz-templates/${quiz.id}/questions`, {
      data: { text: "Bad", type: "open", options: [], referenceAnswer: "Something", points: 0 },
    });
    expect(res.status()).toBe(400);
  });

  test("single/multi questions are always worth 1 point regardless of what's sent", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const question = await addQuestion(authedRequest, quiz.id, { points: 99 });
    expect(question.points).toBe(1);
  });

  test("publishes a quiz mixing open and choice questions", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    await addQuestion(authedRequest, quiz.id);
    await addQuestion(authedRequest, quiz.id, { text: "Question 2?" });
    await addQuestion(authedRequest, quiz.id, {
      text: "Explain photosynthesis.",
      type: "open",
      options: [],
      referenceAnswer: "Plants convert light into energy.",
      points: 5,
    });

    const res = await authedRequest.patch(`/quiz-templates/${quiz.id}/status`, { data: { status: "published" } });
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe("published");
  });
});

test.describe("PATCH /quiz-templates/:id/status — Edit <-> Execution (3.4)", () => {
  test("refuses to publish with fewer than 3 questions", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    await addQuestion(authedRequest, quiz.id);
    await addQuestion(authedRequest, quiz.id);

    const res = await authedRequest.patch(`/quiz-templates/${quiz.id}/status`, {
      data: { status: "published" },
    });
    expect(res.status()).toBe(400);
  });

  test("publishes with >= 3 valid questions", async ({ authedRequest }) => {
    const quiz = await createPublishedQuiz(authedRequest);
    expect(quiz.status).toBe("published");
  });

  test("Execution -> Edit is always available", async ({ authedRequest }) => {
    const quiz = await createPublishedQuiz(authedRequest);
    const res = await authedRequest.patch(`/quiz-templates/${quiz.id}/status`, { data: { status: "draft" } });
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe("draft");
  });
});

test.describe("DELETE /quiz-templates/:id", () => {
  test("deletes a quiz with no assignments", async ({ authedRequest }) => {
    const quiz = await createDraftQuiz(authedRequest);
    const res = await authedRequest.delete(`/quiz-templates/${quiz.id}`);
    expect(res.status()).toBe(204);

    const getRes = await authedRequest.get(`/quiz-templates/${quiz.id}`);
    expect(getRes.status()).toBe(404);
  });

  test("cascades through assignments and attempts (no FK errors), leaving the cohort intact", async ({
    authedRequest,
    request,
  }) => {
    const quiz = await createPublishedQuiz(authedRequest);
    const cohort = await createCohort(authedRequest);
    const assignment = await createAssignment(authedRequest, cohort.id, { quizTemplateId: quiz.id });
    await joinAttempt(request, { accessCode: assignment.accessCode });

    const res = await authedRequest.delete(`/quiz-templates/${quiz.id}`);
    expect(res.status()).toBe(204);

    const cohortRes = await authedRequest.get(`/cohorts/${cohort.id}`);
    expect(cohortRes.status()).toBe(200);
    const assignmentsRes = await authedRequest.get(`/cohorts/${cohort.id}/assignments`);
    expect(await assignmentsRes.json()).toEqual([]);
  });

  test("cannot delete a quiz you don't own (404)", async ({ authedRequest, request }) => {
    const otherEmail = uniqueEmail("other");
    const otherRegister = await request.post("/auth/register", {
      data: { name: "Owner", email: otherEmail, password: "correct-horse-battery-staple" },
    });
    const { accessToken: otherToken } = await otherRegister.json();
    const otherQuiz = await createDraftQuiz(request, "Not yours", authHeader(otherToken));

    const res = await authedRequest.delete(`/quiz-templates/${otherQuiz.id}`);
    expect(res.status()).toBe(404);

    const stillThere = await request.get(`/quiz-templates/${otherQuiz.id}`, { headers: authHeader(otherToken) });
    expect(stillThere.status()).toBe(200);
  });
});
