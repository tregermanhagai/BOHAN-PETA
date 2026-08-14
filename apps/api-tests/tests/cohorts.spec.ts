import { test, expect } from "../support/fixtures";
import { uniqueCohortName, uniqueEmail } from "../support/test-data";

test.describe("POST /cohorts", () => {
  test("creates a cohort with just a name", async ({ authedRequest, teacher }) => {
    const name = uniqueCohortName();
    const res = await authedRequest.post("/cohorts", { data: { name } });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      name,
      teacherId: teacher.id,
      startDate: null,
      endDate: null,
      archived: false,
    });
    expect(body.id).toEqual(expect.any(String));
  });

  test("creates a cohort with start/end dates", async ({ authedRequest }) => {
    const res = await authedRequest.post("/cohorts", {
      data: { name: uniqueCohortName(), startDate: "2026-01-05", endDate: "2026-03-20" },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.startDate).toBe("2026-01-05");
    expect(body.endDate).toBe("2026-03-20");
  });

  test("rejects a missing name with 400", async ({ authedRequest }) => {
    const res = await authedRequest.post("/cohorts", { data: {} });
    expect(res.status()).toBe(400);
  });

  test("rejects a malformed date with 400", async ({ authedRequest }) => {
    const res = await authedRequest.post("/cohorts", {
      data: { name: uniqueCohortName(), startDate: "not-a-date" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects an unauthenticated request with 401", async ({ request }) => {
    const res = await request.post("/cohorts", { data: { name: uniqueCohortName() } });
    expect(res.status()).toBe(401);
  });
});

test.describe("GET /cohorts", () => {
  test("lists only the calling teacher's cohorts", async ({ authedRequest, teacher, request }) => {
    const myName = uniqueCohortName("Mine");
    await authedRequest.post("/cohorts", { data: { name: myName } });

    // A second, unrelated teacher with their own cohort.
    const otherEmail = uniqueEmail("other");
    const otherRegister = await request.post("/auth/register", {
      data: { name: "Other Teacher", email: otherEmail, password: "correct-horse-battery-staple" },
    });
    const { accessToken: otherToken } = await otherRegister.json();
    await request.post("/cohorts", {
      data: { name: uniqueCohortName("NotMine") },
      headers: { Authorization: `Bearer ${otherToken}` },
    });

    const res = await authedRequest.get("/cohorts");
    expect(res.status()).toBe(200);
    const cohorts = await res.json();

    expect(cohorts.every((c: { teacherId: string }) => c.teacherId === teacher.id)).toBe(true);
    expect(cohorts.some((c: { name: string }) => c.name === myName)).toBe(true);
  });
});

test.describe("GET /cohorts/:id", () => {
  test("returns a cohort owned by the caller", async ({ authedRequest }) => {
    const created = await (await authedRequest.post("/cohorts", { data: { name: uniqueCohortName() } })).json();

    const res = await authedRequest.get(`/cohorts/${created.id}`);
    expect(res.status()).toBe(200);
    expect((await res.json()).id).toBe(created.id);
  });

  test("returns 404 for a nonexistent id", async ({ authedRequest }) => {
    const res = await authedRequest.get("/cohorts/00000000-0000-0000-0000-000000000000");
    expect(res.status()).toBe(404);
  });

  test("returns 404 (not another teacher's data) for a cohort you don't own", async ({
    authedRequest,
    request,
  }) => {
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

    const res = await authedRequest.get(`/cohorts/${otherCohort.id}`);
    expect(res.status()).toBe(404);
  });
});

test.describe("PATCH /cohorts/:id", () => {
  test("updates the cohort name", async ({ authedRequest }) => {
    const created = await (await authedRequest.post("/cohorts", { data: { name: uniqueCohortName() } })).json();
    const newName = uniqueCohortName("Renamed");

    const res = await authedRequest.patch(`/cohorts/${created.id}`, { data: { name: newName } });
    expect(res.status()).toBe(200);
    expect((await res.json()).name).toBe(newName);
  });

  test("archives and unarchives a cohort (F-20)", async ({ authedRequest }) => {
    const created = await (await authedRequest.post("/cohorts", { data: { name: uniqueCohortName() } })).json();

    const archived = await authedRequest.patch(`/cohorts/${created.id}`, { data: { archived: true } });
    expect((await archived.json()).archived).toBe(true);

    const unarchived = await authedRequest.patch(`/cohorts/${created.id}`, { data: { archived: false } });
    expect((await unarchived.json()).archived).toBe(false);
  });

  test("cannot update a cohort you don't own (404)", async ({ authedRequest, request }) => {
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

    const res = await authedRequest.patch(`/cohorts/${otherCohort.id}`, { data: { name: "Hijacked" } });
    expect(res.status()).toBe(404);

    // And it really didn't change, from the owner's point of view.
    const stillOriginal = await request.get(`/cohorts/${otherCohort.id}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    expect((await stillOriginal.json()).name).toBe(otherCohort.name);
  });
});
