import { test, expect } from "../support/fixtures";
import { uniqueCohortName, uniqueEmail } from "../support/test-data";
import { authHeader, createDraftQuiz, createPublishedQuiz } from "../support/quiz-helpers";

async function createCohort(authedRequest: import("@playwright/test").APIRequestContext, name?: string) {
  const res = await authedRequest.post("/cohorts", { data: { name: name ?? uniqueCohortName() } });
  return res.json();
}

test.describe("POST /cohorts/:cohortId/assignments", () => {
  test("creates an assignment with a generated access code and default settings", async ({
    authedRequest,
  }) => {
    const cohort = await createCohort(authedRequest);
    const quiz = await createPublishedQuiz(authedRequest);

    const res = await authedRequest.post(`/cohorts/${cohort.id}/assignments`, {
      data: { quizTemplateId: quiz.id },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      quizTemplateId: quiz.id,
      cohortId: cohort.id,
      quizTemplateTitle: quiz.title,
      maxAttempts: 1,
      shuffle: true,
    });
    expect(body.accessCode).toMatch(/^\d{6}$/);
  });

  test("rejects assigning a quiz that's still in Draft (F-XX)", async ({ authedRequest }) => {
    const cohort = await createCohort(authedRequest);
    const quiz = await createDraftQuiz(authedRequest);

    const res = await authedRequest.post(`/cohorts/${cohort.id}/assignments`, {
      data: { quizTemplateId: quiz.id },
    });
    expect(res.status()).toBe(400);
  });

  test("accepts custom maxAttempts/shuffle/open/close settings", async ({ authedRequest }) => {
    const cohort = await createCohort(authedRequest);
    const quiz = await createPublishedQuiz(authedRequest);

    const res = await authedRequest.post(`/cohorts/${cohort.id}/assignments`, {
      data: {
        quizTemplateId: quiz.id,
        maxAttempts: 3,
        shuffle: false,
        openAt: "2026-01-01T00:00:00.000Z",
        closeAt: "2026-02-01T00:00:00.000Z",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.maxAttempts).toBe(3);
    expect(body.shuffle).toBe(false);
    expect(new Date(body.openAt).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(new Date(body.closeAt).toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  test("generates distinct access codes for separate assignments", async ({ authedRequest }) => {
    const cohort = await createCohort(authedRequest);
    const quizA = await createPublishedQuiz(authedRequest, "Quiz A");
    const quizB = await createPublishedQuiz(authedRequest, "Quiz B");

    const a = await (
      await authedRequest.post(`/cohorts/${cohort.id}/assignments`, { data: { quizTemplateId: quizA.id } })
    ).json();
    const b = await (
      await authedRequest.post(`/cohorts/${cohort.id}/assignments`, { data: { quizTemplateId: quizB.id } })
    ).json();

    expect(a.accessCode).not.toBe(b.accessCode);
  });

  test("404s when the cohort doesn't belong to the caller", async ({ authedRequest, request }) => {
    const quiz = await createPublishedQuiz(authedRequest);

    const otherEmail = uniqueEmail("other");
    const otherRegister = await request.post("/auth/register", {
      data: { name: "Owner", email: otherEmail, password: "correct-horse-battery-staple" },
    });
    const { accessToken: otherToken } = await otherRegister.json();
    const otherCohort = await (
      await request.post("/cohorts", {
        data: { name: uniqueCohortName() },
        headers: { Authorization: `Bearer ${otherToken}` },
      })
    ).json();

    const res = await authedRequest.post(`/cohorts/${otherCohort.id}/assignments`, {
      data: { quizTemplateId: quiz.id },
    });
    expect(res.status()).toBe(404);
  });

  test("404s when the quiz template doesn't belong to the caller, even if the cohort does", async ({
    authedRequest,
    request,
  }) => {
    const cohort = await createCohort(authedRequest);

    const otherEmail = uniqueEmail("other");
    const otherRegister = await request.post("/auth/register", {
      data: { name: "Owner", email: otherEmail, password: "correct-horse-battery-staple" },
    });
    const { accessToken: otherToken } = await otherRegister.json();
    const otherQuiz = await createPublishedQuiz(request, "Other teacher's quiz", authHeader(otherToken));

    const res = await authedRequest.post(`/cohorts/${cohort.id}/assignments`, {
      data: { quizTemplateId: otherQuiz.id },
    });
    expect(res.status()).toBe(404);
  });
});

test.describe("GET /cohorts/:cohortId/assignments", () => {
  test("lists assignments for the cohort, including the quiz title", async ({ authedRequest }) => {
    const cohort = await createCohort(authedRequest);
    const quiz = await createPublishedQuiz(authedRequest);
    await authedRequest.post(`/cohorts/${cohort.id}/assignments`, { data: { quizTemplateId: quiz.id } });

    const res = await authedRequest.get(`/cohorts/${cohort.id}/assignments`);
    expect(res.status()).toBe(200);
    const list = await res.json();
    expect(list).toHaveLength(1);
    expect(list[0].quizTemplateTitle).toBe(quiz.title);
  });

  test("returns an empty list for a cohort with no assignments", async ({ authedRequest }) => {
    const cohort = await createCohort(authedRequest);
    const res = await authedRequest.get(`/cohorts/${cohort.id}/assignments`);
    expect(await res.json()).toEqual([]);
  });

  test("lists newest-created assignment first", async ({ authedRequest }) => {
    const cohort = await createCohort(authedRequest);
    const quiz = await createPublishedQuiz(authedRequest);
    const first = await (
      await authedRequest.post(`/cohorts/${cohort.id}/assignments`, { data: { quizTemplateId: quiz.id } })
    ).json();
    const second = await (
      await authedRequest.post(`/cohorts/${cohort.id}/assignments`, { data: { quizTemplateId: quiz.id } })
    ).json();

    const res = await authedRequest.get(`/cohorts/${cohort.id}/assignments`);
    const list = await res.json();
    expect(list.map((a: { id: string }) => a.id)).toEqual([second.id, first.id]);
  });
});

test.describe("DELETE /cohorts/:cohortId/assignments/:id", () => {
  test("deletes an assignment", async ({ authedRequest }) => {
    const cohort = await createCohort(authedRequest);
    const quiz = await createPublishedQuiz(authedRequest);
    const assignment = await (
      await authedRequest.post(`/cohorts/${cohort.id}/assignments`, { data: { quizTemplateId: quiz.id } })
    ).json();

    const res = await authedRequest.delete(`/cohorts/${cohort.id}/assignments/${assignment.id}`);
    expect(res.status()).toBe(204);

    const list = await (await authedRequest.get(`/cohorts/${cohort.id}/assignments`)).json();
    expect(list).toEqual([]);
  });

  test("404s for an assignment that doesn't belong to the cohort", async ({ authedRequest }) => {
    const cohortA = await createCohort(authedRequest);
    const cohortB = await createCohort(authedRequest);
    const quiz = await createPublishedQuiz(authedRequest);
    const assignment = await (
      await authedRequest.post(`/cohorts/${cohortA.id}/assignments`, { data: { quizTemplateId: quiz.id } })
    ).json();

    const res = await authedRequest.delete(`/cohorts/${cohortB.id}/assignments/${assignment.id}`);
    expect(res.status()).toBe(404);
  });

  test("cannot delete an assignment under a cohort you don't own (404)", async ({ authedRequest, request }) => {
    const otherEmail = uniqueEmail("other");
    const otherRegister = await request.post("/auth/register", {
      data: { name: "Owner", email: otherEmail, password: "correct-horse-battery-staple" },
    });
    const { accessToken: otherToken } = await otherRegister.json();
    const otherCohort = await (
      await request.post("/cohorts", {
        data: { name: uniqueCohortName() },
        headers: authHeader(otherToken),
      })
    ).json();
    const otherQuiz = await createPublishedQuiz(request, "Other quiz", authHeader(otherToken));
    const otherAssignment = await (
      await request.post(`/cohorts/${otherCohort.id}/assignments`, {
        data: { quizTemplateId: otherQuiz.id },
        headers: authHeader(otherToken),
      })
    ).json();

    const res = await authedRequest.delete(`/cohorts/${otherCohort.id}/assignments/${otherAssignment.id}`);
    expect(res.status()).toBe(404);
  });
});
