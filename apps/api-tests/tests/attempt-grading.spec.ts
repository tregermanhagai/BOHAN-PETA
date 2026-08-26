import { test, expect } from "../support/fixtures";
import { createAssignment, createCohort, joinAttempt, setUpExamReadyQuiz } from "../support/attempt-helpers";
import { uniqueEmail } from "../support/test-data";

test.describe("GET/PATCH /attempts/:id/grading", () => {
  test("teacher can view and override grades for both a choice and an open question", async ({
    authedRequest,
    request,
  }) => {
    const quiz = await (await authedRequest.post("/quiz-templates", { data: { title: "Grading Quiz" } })).json();
    const q1 = await (
      await authedRequest.post(`/quiz-templates/${quiz.id}/questions`, {
        data: {
          text: "Q1",
          type: "single",
          options: [
            { text: "A", isCorrect: true },
            { text: "B", isCorrect: false },
          ],
        },
      })
    ).json();
    const q2 = await (
      await authedRequest.post(`/quiz-templates/${quiz.id}/questions`, {
        data: {
          text: "Q2",
          type: "single",
          options: [
            { text: "A", isCorrect: true },
            { text: "B", isCorrect: false },
          ],
        },
      })
    ).json();
    const q3 = await (
      await authedRequest.post(`/quiz-templates/${quiz.id}/questions`, {
        data: { text: "Explain X", type: "open", options: [], referenceAnswer: "ref answer", points: 5 },
      })
    ).json();
    await authedRequest.patch(`/quiz-templates/${quiz.id}/status`, { data: { status: "published" } });

    const cohort = await createCohort(authedRequest);
    const assignment = await createAssignment(authedRequest, cohort.id, { quizTemplateId: quiz.id });
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });

    // q1 answered wrong, q2 left unanswered, q3 answered with free text
    // (AI is unconfigured in this test env, so it scores 0 until overridden).
    const q1Wrong = q1.options.find((o: { isCorrect: boolean }) => !o.isCorrect).id;
    await request.put(`/attempts/${attemptId}/answers/${q1.id}`, { data: { selectedOptionIds: [q1Wrong] } });
    await request.put(`/attempts/${attemptId}/answers/${q3.id}`, {
      data: { selectedOptionIds: [], answerText: "some answer" },
    });
    await request.post(`/attempts/${attemptId}/submit`);

    // Baseline: 0/1 + 0/1 + 0/5 = 0/7 = 0%.
    const before = await (await authedRequest.get(`/attempts/${attemptId}/grading`)).json();
    expect(before.score).toBe(0);
    const beforeQ1 = before.questions.find((q: { id: string }) => q.id === q1.id);
    expect(beforeQ1.correct).toBe(false);
    expect(beforeQ1.overridePoints).toBeNull();

    // Teacher overrides: mark q1 correct (1pt), give q3 partial credit (3/5).
    const patchRes = await authedRequest.patch(`/attempts/${attemptId}/grading`, {
      data: {
        overrides: [
          { questionId: q1.id, points: 1 },
          { questionId: q3.id, points: 3 },
        ],
      },
    });
    expect(patchRes.status()).toBe(200);
    const after = await patchRes.json();
    // earned = 1 (q1 override) + 0 (q2 unanswered) + 3 (q3 override) = 4 / 7 total.
    expect(after.score).toBeCloseTo((4 / 7) * 100, 1);
    const afterQ1 = after.questions.find((q: { id: string }) => q.id === q1.id);
    expect(afterQ1.correct).toBe(true);
    expect(afterQ1.overridePoints).toBe(1);
    const afterQ3 = after.questions.find((q: { id: string }) => q.id === q3.id);
    expect(afterQ3.pointsEarned).toBe(3);
    expect(afterQ3.overridePoints).toBe(3);

    // The student's own review reflects the same override — same derivation.
    const studentReview = await (await request.get(`/attempts/${attemptId}/review`)).json();
    expect(studentReview.score).toBeCloseTo((4 / 7) * 100, 1);

    // Clearing an override (points: null) reverts to the derived value.
    const clearRes = await authedRequest.patch(`/attempts/${attemptId}/grading`, {
      data: { overrides: [{ questionId: q1.id, points: null }] },
    });
    const cleared = await clearRes.json();
    // earned = 0 (q1 reverted to wrong) + 0 (q2) + 3 (q3 still overridden) = 3/7.
    expect(cleared.score).toBeCloseTo((3 / 7) * 100, 1);
    const clearedQ1 = cleared.questions.find((q: { id: string }) => q.id === q1.id);
    expect(clearedQ1.overridePoints).toBeNull();
    expect(clearedQ1.correct).toBe(false);
  });

  test("accepts notifyStudent without failing, even though SMTP is unconfigured in this test env", async ({
    authedRequest,
    request,
  }) => {
    const { assignment, questions } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });
    await request.post(`/attempts/${attemptId}/submit`);

    const res = await authedRequest.patch(`/attempts/${attemptId}/grading`, {
      data: { overrides: [{ questionId: questions[0].id, points: 1 }], notifyStudent: true },
    });
    expect(res.status()).toBe(200);
  });

  test("rejects an override that exceeds a question's max points", async ({ authedRequest, request }) => {
    const { assignment, questions } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });
    await request.post(`/attempts/${attemptId}/submit`);

    const res = await authedRequest.patch(`/attempts/${attemptId}/grading`, {
      data: { overrides: [{ questionId: questions[0].id, points: 99 }] },
    });
    expect(res.status()).toBe(400);
  });

  test("404s for a teacher who doesn't own the attempt", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });
    await request.post(`/attempts/${attemptId}/submit`);

    const otherEmail = uniqueEmail("other");
    const otherRegister = await request.post("/auth/register", {
      data: { name: "Other Teacher", email: otherEmail, password: "correct-horse-battery-staple" },
    });
    const { accessToken: otherToken } = await otherRegister.json();

    const getRes = await request.get(`/attempts/${attemptId}/grading`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    expect(getRes.status()).toBe(404);

    const patchRes = await request.patch(`/attempts/${attemptId}/grading`, {
      data: { overrides: [{ questionId: "00000000-0000-0000-0000-000000000000", points: 1 }] },
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    expect(patchRes.status()).toBe(404);
  });

  test("refuses to grade an attempt still in progress", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });

    const res = await authedRequest.get(`/attempts/${attemptId}/grading`);
    expect(res.status()).toBe(400);
  });

  test("always reveals the answer key to the teacher, even when the quiz doesn't reveal it to students", async ({
    authedRequest,
    request,
  }) => {
    // revealAnswerKey defaults to false here.
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });
    await request.post(`/attempts/${attemptId}/submit`);

    const grading = await (await authedRequest.get(`/attempts/${attemptId}/grading`)).json();
    const q1 = grading.questions[0];
    expect(q1.options.some((o: { isCorrect?: boolean }) => o.isCorrect !== undefined)).toBe(true);

    // The student's own review still respects revealAnswerKey=false.
    const studentReview = await (await request.get(`/attempts/${attemptId}/review`)).json();
    const studentQ1 = studentReview.questions[0];
    expect(studentQ1.options.every((o: { isCorrect?: boolean }) => o.isCorrect === undefined)).toBe(true);
  });
});

test.describe("DELETE /attempts/:id", () => {
  test("deletes an attempt the teacher owns", async ({ authedRequest, request }) => {
    const { assignment, cohort } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });

    const res = await authedRequest.delete(`/attempts/${attemptId}`);
    expect(res.status()).toBe(204);

    const scoresRes = await authedRequest.get(`/cohorts/${cohort.id}/scores`);
    const rows = await scoresRes.json();
    expect(rows.find((r: { attemptId: string }) => r.attemptId === attemptId)).toBeUndefined();
  });

  test("404s deleting an attempt under another teacher's cohort", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });

    const otherEmail = uniqueEmail("other");
    const otherRegister = await request.post("/auth/register", {
      data: { name: "Other Teacher", email: otherEmail, password: "correct-horse-battery-staple" },
    });
    const { accessToken: otherToken } = await otherRegister.json();

    const res = await request.delete(`/attempts/${attemptId}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    expect(res.status()).toBe(404);
  });
});
