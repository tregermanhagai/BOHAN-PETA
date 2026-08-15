import { test, expect } from "../support/fixtures";
import { createAssignment, joinAttempt, setUpExamReadyQuiz, uniqueValidNationalId } from "../support/attempt-helpers";
import { rewindAttemptStartedAt } from "../support/db";

test.describe("POST /assignments/join", () => {
  test("joins successfully with valid data", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    const res = await request.post("/assignments/join", {
      data: {
        firstName: "Dana",
        lastName: "Cohen",
        nationalId: uniqueValidNationalId(),
        accessCode: assignment.accessCode,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.attemptId).toEqual(expect.any(String));
    expect(body.quizTitle).toBe("Exam Flow Quiz");
    expect(body.questionCount).toBe(3);
  });

  test("rejects a national ID that fails the checksum (F-02)", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    const res = await request.post("/assignments/join", {
      data: { firstName: "X", lastName: "Y", nationalId: "111111111", accessCode: assignment.accessCode },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects an unknown access code", async ({ request }) => {
    const res = await request.post("/assignments/join", {
      data: { firstName: "X", lastName: "Y", nationalId: uniqueValidNationalId(), accessCode: "000000" },
    });
    expect(res.status()).toBe(404);
  });

  test("rejects joining a quiz assignment that hasn't opened yet", async ({ authedRequest, request }) => {
    const { cohort, quiz } = await setUpExamReadyQuiz(authedRequest);
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const assignment = await createAssignment(authedRequest, cohort.id, {
      quizTemplateId: quiz.id,
      openAt: future,
    });
    const res = await request.post("/assignments/join", {
      data: {
        firstName: "X",
        lastName: "Y",
        nationalId: uniqueValidNationalId(),
        accessCode: assignment.accessCode,
      },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects joining a closed quiz assignment", async ({ authedRequest, request }) => {
    const { cohort, quiz } = await setUpExamReadyQuiz(authedRequest);
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const assignment = await createAssignment(authedRequest, cohort.id, {
      quizTemplateId: quiz.id,
      closeAt: past,
    });
    const res = await request.post("/assignments/join", {
      data: {
        firstName: "X",
        lastName: "Y",
        nationalId: uniqueValidNationalId(),
        accessCode: assignment.accessCode,
      },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects a second attempt with the default maxAttempts=1", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    const nationalId = uniqueValidNationalId();
    const first = await request.post("/assignments/join", {
      data: { firstName: "Same", lastName: "Person", nationalId, accessCode: assignment.accessCode },
    });
    expect(first.status()).toBe(201);

    // v2.5 fix: the block is keyed on national_id, not name — try a
    // slightly different name spelling on the same ID to confirm it's
    // still recognized as the same student.
    const second = await request.post("/assignments/join", {
      data: { firstName: "sAME", lastName: "PERSON", nationalId, accessCode: assignment.accessCode },
    });
    expect(second.status()).toBe(409);
  });

  test("allows a second attempt when maxAttempts=2, blocks a third", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest, { maxAttempts: 2 });
    const nationalId = uniqueValidNationalId();
    const data = { firstName: "Multi", lastName: "Attempt", nationalId, accessCode: assignment.accessCode };

    expect((await request.post("/assignments/join", { data })).status()).toBe(201);
    expect((await request.post("/assignments/join", { data })).status()).toBe(201);
    expect((await request.post("/assignments/join", { data })).status()).toBe(409);
  });

  test("rejects joining a quiz that's back in Edit Mode", async ({ authedRequest, request }) => {
    const { assignment, quiz } = await setUpExamReadyQuiz(authedRequest);
    await authedRequest.patch(`/quiz-templates/${quiz.id}/status`, { data: { status: "draft" } });

    const res = await request.post("/assignments/join", {
      data: {
        firstName: "X",
        lastName: "Y",
        nationalId: uniqueValidNationalId(),
        accessCode: assignment.accessCode,
      },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("GET /attempts/:id/questions", () => {
  test("never leaks which option is correct", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });

    const res = await request.get(`/attempts/${attemptId}/questions`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    for (const q of body.questions) {
      for (const opt of q.options) {
        expect(opt).not.toHaveProperty("isCorrect");
      }
    }
  });

  test("returns previously saved answers (resume, F-05)", async ({ authedRequest, request }) => {
    const { assignment, questions } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });
    const q1 = questions[0];
    const correctOptionId = q1.options.find((o) => o.isCorrect)!.id;

    await request.put(`/attempts/${attemptId}/answers/${q1.id}`, {
      data: { selectedOptionIds: [correctOptionId] },
    });

    const res = await request.get(`/attempts/${attemptId}/questions`);
    const body = await res.json();
    const fetched = body.questions.find((q: { id: string }) => q.id === q1.id);
    expect(fetched.selectedOptionIds).toEqual([correctOptionId]);
  });

  test("404s for a nonexistent attempt", async ({ request }) => {
    const res = await request.get("/attempts/00000000-0000-0000-0000-000000000000/questions");
    expect(res.status()).toBe(404);
  });
});

test.describe("PUT /attempts/:id/answers/:questionId", () => {
  test("saving twice overwrites rather than duplicating", async ({ authedRequest, request }) => {
    const { assignment, questions } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });
    const q2 = questions[1];
    const [optA, , optC] = q2.options;

    await request.put(`/attempts/${attemptId}/answers/${q2.id}`, { data: { selectedOptionIds: [optA.id] } });
    await request.put(`/attempts/${attemptId}/answers/${q2.id}`, {
      data: { selectedOptionIds: [optA.id, optC.id] },
    });

    const res = await request.get(`/attempts/${attemptId}/questions`);
    const body = await res.json();
    const fetched = body.questions.find((q: { id: string }) => q.id === q2.id);
    expect(fetched.selectedOptionIds.sort()).toEqual([optA.id, optC.id].sort());
  });

  test("rejects a question that isn't part of this attempt", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });

    const res = await request.put(`/attempts/${attemptId}/answers/00000000-0000-0000-0000-000000000000`, {
      data: { selectedOptionIds: [] },
    });
    expect(res.status()).toBe(404);
  });

  test("rejects saving after the attempt is submitted", async ({ authedRequest, request }) => {
    const { assignment, questions } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });
    await request.post(`/attempts/${attemptId}/submit`);

    const res = await request.put(`/attempts/${attemptId}/answers/${questions[0].id}`, {
      data: { selectedOptionIds: [] },
    });
    expect(res.status()).toBe(409);
  });
});

test.describe("POST /attempts/:id/submit — scoring (F-13a)", () => {
  test("scores a fully-correct attempt at 100", async ({ authedRequest, request }) => {
    const { assignment, questions } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });

    for (const q of questions) {
      const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
      await request.put(`/attempts/${attemptId}/answers/${q.id}`, { data: { selectedOptionIds: correctIds } });
    }

    const res = await request.post(`/attempts/${attemptId}/submit`);
    const body = await res.json();
    expect(body.score).toBe(100);
    expect(body.passed).toBe(true);
    expect(body.endedReason).toBe("submitted");
  });

  test("a partially-correct multi-select answer scores as wrong (no partial credit)", async ({
    authedRequest,
    request,
  }) => {
    const { assignment, questions } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });
    const q2 = questions[1]; // multi, correct = {A, C}
    const optA = q2.options.find((o) => o.text === "A")!;

    // Only select A, not C — should not get credit for this question.
    await request.put(`/attempts/${attemptId}/answers/${q2.id}`, { data: { selectedOptionIds: [optA.id] } });
    const res = await request.post(`/attempts/${attemptId}/submit`);
    const body = await res.json();
    // 0 of 3 correct (only Q2 was answered, and it's wrong).
    expect(body.score).toBe(0);
  });

  test("selecting an extra incorrect option alongside the correct ones also scores as wrong", async ({
    authedRequest,
    request,
  }) => {
    const { assignment, questions } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });
    const q2 = questions[1]; // multi, correct = {A, C}
    const [optA, optB, optC] = q2.options;

    await request.put(`/attempts/${attemptId}/answers/${q2.id}`, {
      data: { selectedOptionIds: [optA.id, optB.id, optC.id] },
    });
    const res = await request.post(`/attempts/${attemptId}/submit`);
    const body = await res.json();
    expect(body.score).toBe(0);
  });

  test("unanswered questions count against the score", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });

    const res = await request.post(`/attempts/${attemptId}/submit`);
    const body = await res.json();
    expect(body.score).toBe(0);
    expect(body.passed).toBe(false);
  });

  test("is idempotent — resubmitting returns the same result", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });

    const first = await (await request.post(`/attempts/${attemptId}/submit`)).json();
    const second = await (await request.post(`/attempts/${attemptId}/submit`)).json();
    expect(second).toEqual(first);
  });
});

test.describe("POST /attempts/:id/auto-submit", () => {
  test("ends the attempt with endedReason=focus_loss", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });

    const res = await request.post(`/attempts/${attemptId}/auto-submit`);
    const body = await res.json();
    expect(body.endedReason).toBe("focus_loss");
  });
});

test.describe("Server-side time enforcement (3.7)", () => {
  test("auto-finalizes an expired attempt as time_expired using answers given so far", async ({
    authedRequest,
    request,
  }) => {
    const { assignment, questions } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });
    const q1 = questions[0];
    const correctOptionId = q1.options.find((o) => o.isCorrect)!.id;
    await request.put(`/attempts/${attemptId}/answers/${q1.id}`, {
      data: { selectedOptionIds: [correctOptionId] },
    });

    // Quiz's default duration is 30 minutes (schema default) — rewind
    // past that without needing to wait in real time.
    await rewindAttemptStartedAt(attemptId, 31);

    const res = await request.get(`/attempts/${attemptId}/questions`);
    const body = await res.json();
    expect(body.endedReason).toBe("time_expired");

    const result = await (await request.post(`/attempts/${attemptId}/submit`)).json();
    expect(result.endedReason).toBe("time_expired");
    // Only Q1 (of 3) was answered and it was correct.
    expect(result.score).toBeCloseTo(33.33, 1);
  });

  test("rejects saving an answer once expired", async ({ authedRequest, request }) => {
    const { assignment, questions } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });
    await rewindAttemptStartedAt(attemptId, 31);

    const res = await request.put(`/attempts/${attemptId}/answers/${questions[0].id}`, {
      data: { selectedOptionIds: [] },
    });
    expect(res.status()).toBe(409);
  });
});

test.describe("GET /attempts/:id/review", () => {
  test("hides the answer key by default (F-07a low-leak tier)", async ({ authedRequest, request }) => {
    const { assignment, questions } = await setUpExamReadyQuiz(authedRequest, { revealAnswerKey: false });
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });
    const q1 = questions[0];
    await request.put(`/attempts/${attemptId}/answers/${q1.id}`, {
      data: { selectedOptionIds: [q1.options.find((o) => o.isCorrect)!.id] },
    });
    await request.post(`/attempts/${attemptId}/submit`);

    const res = await request.get(`/attempts/${attemptId}/review`);
    const body = await res.json();
    expect(body.revealAnswerKey).toBe(false);
    const reviewedQ1 = body.questions.find((q: { id: string }) => q.id === q1.id);
    expect(reviewedQ1.correct).toBe(true);
    for (const opt of reviewedQ1.options) {
      expect(opt).not.toHaveProperty("isCorrect");
    }
  });

  test("reveals the answer key when the teacher enabled it (F-07b)", async ({ authedRequest, request }) => {
    const { assignment, questions } = await setUpExamReadyQuiz(authedRequest, { revealAnswerKey: true });
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });
    await request.post(`/attempts/${attemptId}/submit`);

    const res = await request.get(`/attempts/${attemptId}/review`);
    const body = await res.json();
    expect(body.revealAnswerKey).toBe(true);
    const q1 = questions[0];
    const reviewedQ1 = body.questions.find((q: { id: string }) => q.id === q1.id);
    expect(reviewedQ1.options.find((o: { isCorrect?: boolean }) => o.isCorrect === true)).toBeTruthy();
  });

  test("refuses to show a review while the attempt is still in progress", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });

    const res = await request.get(`/attempts/${attemptId}/review`);
    expect(res.status()).toBe(400);
  });
});
