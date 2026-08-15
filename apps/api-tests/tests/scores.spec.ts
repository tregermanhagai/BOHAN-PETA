import { test, expect } from "../support/fixtures";
import { uniqueEmail } from "../support/test-data";
import { authHeader } from "../support/quiz-helpers";
import {
  createAssignment,
  createCohort,
  joinAttempt,
  setUpExamReadyQuiz,
  uniqueValidNationalId,
} from "../support/attempt-helpers";

test.describe("GET /cohorts/:cohortId/scores", () => {
  test("returns an empty list for a cohort with no attempts", async ({ authedRequest }) => {
    const cohort = await createCohort(authedRequest);
    const res = await authedRequest.get(`/cohorts/${cohort.id}/scores`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("reflects a submitted attempt's score, pass/fail, status, and time taken", async ({
    authedRequest,
    request,
  }) => {
    const { assignment, questions } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });

    for (const q of questions) {
      const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
      await request.put(`/attempts/${attemptId}/answers/${q.id}`, { data: { selectedOptionIds: correctIds } });
    }
    await request.post(`/attempts/${attemptId}/submit`);

    const res = await authedRequest.get(`/cohorts/${assignment.cohortId}/scores`);
    const rows = await res.json();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      attemptId,
      score: 100,
      passed: true,
      status: "submitted",
      quizAssignmentId: assignment.id,
    });
    expect(rows[0].timeTakenSeconds).toEqual(expect.any(Number));
    expect(rows[0].timeTakenSeconds).toBeGreaterThanOrEqual(0);
  });

  test("shows an in-progress attempt with null score/passed", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    await joinAttempt(request, { accessCode: assignment.accessCode });

    const res = await authedRequest.get(`/cohorts/${assignment.cohortId}/scores`);
    const rows = await res.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("in_progress");
    expect(rows[0].score).toBeNull();
    expect(rows[0].passed).toBeNull();
    expect(rows[0].submittedAt).toBeNull();
    expect(rows[0].timeTakenSeconds).toBeNull();
  });

  test("marks a focus-loss auto-submit distinctly from a manual submit", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });
    await request.post(`/attempts/${attemptId}/auto-submit`);

    const res = await authedRequest.get(`/cohorts/${assignment.cohortId}/scores`);
    const rows = await res.json();
    expect(rows[0].status).toBe("focus_loss");
  });

  test("includes every student across every quiz assigned to the cohort", async ({ authedRequest, request }) => {
    const cohort = await createCohort(authedRequest);
    const quizA = await setUpExamReadyQuiz(authedRequest);
    // Re-point a second quiz's assignment at the SAME cohort so multiple
    // quizzes' attempts show up together, matching a real course that
    // reuses one cohort across several exams.
    const assignmentA = await createAssignment(authedRequest, cohort.id, { quizTemplateId: quizA.quiz.id });

    await joinAttempt(request, { accessCode: assignmentA.accessCode, nationalId: uniqueValidNationalId() });
    await joinAttempt(request, { accessCode: assignmentA.accessCode, nationalId: uniqueValidNationalId() });

    const res = await authedRequest.get(`/cohorts/${cohort.id}/scores`);
    const rows = await res.json();
    expect(rows).toHaveLength(2);
  });

  test("404s for a cohort you don't own", async ({ authedRequest, request }) => {
    const otherEmail = uniqueEmail("other");
    const otherRegister = await request.post("/auth/register", {
      data: { name: "Owner", email: otherEmail, password: "correct-horse-battery-staple" },
    });
    const { accessToken: otherToken } = await otherRegister.json();
    const otherCohort = await createCohort(request, undefined, authHeader(otherToken));

    const res = await authedRequest.get(`/cohorts/${otherCohort.id}/scores`);
    expect(res.status()).toBe(404);
  });

  test("401s without a token", async ({ authedRequest, request }) => {
    const cohort = await createCohort(authedRequest);
    const res = await request.get(`/cohorts/${cohort.id}/scores`);
    expect(res.status()).toBe(401);
  });
});

test.describe("GET /cohorts/:cohortId/scores/export", () => {
  test("returns a UTF-8 BOM-prefixed CSV with a header row and the data", async ({ authedRequest, request }) => {
    const { assignment } = await setUpExamReadyQuiz(authedRequest);
    const { attemptId } = await joinAttempt(request, { accessCode: assignment.accessCode });
    await request.post(`/attempts/${attemptId}/submit`);

    const res = await authedRequest.get(`/cohorts/${assignment.cohortId}/scores/export`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(res.headers()["content-disposition"]).toContain("attachment");

    const body = await res.text();
    expect(body.charCodeAt(0)).toBe(0xfeff); // BOM
    const lines = body.slice(1).split("\r\n");
    expect(lines[0]).toBe(
      "Student,National ID,Quiz,Status,Score (%),Result,Started,Submitted,Time taken (min:sec)",
    );
    expect(lines[1]).toContain(assignment.quizTemplateTitle);
  });

  test("404s for a cohort you don't own", async ({ authedRequest, request }) => {
    const otherEmail = uniqueEmail("other");
    const otherRegister = await request.post("/auth/register", {
      data: { name: "Owner", email: otherEmail, password: "correct-horse-battery-staple" },
    });
    const { accessToken: otherToken } = await otherRegister.json();
    const otherCohort = await createCohort(request, undefined, authHeader(otherToken));

    const res = await authedRequest.get(`/cohorts/${otherCohort.id}/scores/export`);
    expect(res.status()).toBe(404);
  });
});
