import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env"), quiet: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma";

const ADMIN_EMAIL = "hagai.tregerman@gmail.com";
const COHORT_NAME = "Sample Cohort";
const QUIZ_TITLE = "Playwright with Python — Core Concepts";
// Superseded placeholder from an earlier version of this script — cleaned
// up below so re-running doesn't leave two unrelated sample quizzes.
const LEGACY_QUIZ_TITLE = "Sample Exam — 3 Questions";
const ACCESS_CODE_LENGTH = 6;

// PRD section 9.5's worked example / seed fixture, verbatim — reviewed
// there for technical accuracy (actionability checks, page.route(),
// strict-mode locators, the sync tracing API, APIRequestContext).
const QUESTIONS = [
  {
    text: 'Playwright performs a set of "Actionability" checks on an element before performing actions like click(). Which of the following is NOT a required actionability check for a standard click() operation?',
    sourceReference: "Actionability checks",
    options: [
      { text: "The element is Attached to the DOM.", isCorrect: false },
      { text: "The element is Visible.", isCorrect: false },
      { text: "The element is Focused.", isCorrect: true },
      { text: "The element Receives Events (e.g., not obscured by other elements).", isCorrect: false },
    ],
  },
  {
    text: "What is the correct way to intercept network requests and mock an API response in Playwright (Python)?",
    sourceReference: "Network > Mocking APIs",
    options: [
      { text: 'page.mock_route("**/api/data", handler)', isCorrect: false },
      { text: 'page.route("**/api/data", handler)', isCorrect: true },
      { text: 'page.intercept("**/api/data", handler)', isCorrect: false },
      { text: 'page.network.mock("**/api/data", handler)', isCorrect: false },
    ],
  },
  {
    text: 'By default, what happens if you use page.locator(".submit-btn").click() and the locator resolves to multiple elements on the page?',
    sourceReference: "Locators > Strict mode",
    options: [
      { text: "Playwright automatically clicks the first matching element it finds.", isCorrect: false },
      { text: "Playwright clicks all matching elements sequentially.", isCorrect: false },
      {
        text: "Playwright throws an Error (strict mode violation) because it requires the locator to resolve to a single element.",
        isCorrect: true,
      },
      {
        text: "Playwright waits until only one element matches the locator, failing if the timeout is reached.",
        isCorrect: false,
      },
    ],
  },
  {
    text: "How do you programmatically start and stop tracing to capture a zip file containing DOM snapshots, screenshots, and network requests using the synchronous API?",
    sourceReference: "Trace viewer > Recording a trace",
    options: [
      {
        text: 'context.tracing.start(snapshots=True) followed by context.tracing.stop(path="trace.zip")',
        isCorrect: true,
      },
      {
        text: 'page.trace.start(screenshots=True) followed by page.trace.stop(file="trace.zip")',
        isCorrect: false,
      },
      { text: 'browser.start_tracing() followed by browser.export_trace("trace.zip")', isCorrect: false },
      {
        text: 'context.start_trace(snapshots=True) followed by context.stop_trace("trace.zip")',
        isCorrect: false,
      },
    ],
  },
  {
    text: "When writing tests that require direct HTTP(S) communication without loading a browser window (e.g., for API testing or test data setup), which Playwright class should you use?",
    sourceReference: "API testing",
    options: [
      { text: "BrowserContext", isCorrect: false },
      { text: "HTTPRequestContext", isCorrect: false },
      { text: "APIRequestContext", isCorrect: true },
      { text: "NetworkInterceptor", isCorrect: false },
    ],
  },
];

async function generateUniqueAccessCode(prisma: PrismaClient): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Math.floor(Math.random() * 10 ** ACCESS_CODE_LENGTH)
      .toString()
      .padStart(ACCESS_CODE_LENGTH, "0");
    const existing = await prisma.quizAssignment.findUnique({ where: { accessCode: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique access code");
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const teacher = await prisma.teacher.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!teacher) {
    throw new Error(`No teacher found for ${ADMIN_EMAIL} — run "npm run db:seed" first.`);
  }

  const legacy = await prisma.quizTemplate.findFirst({
    where: { teacherId: teacher.id, title: LEGACY_QUIZ_TITLE },
  });
  if (legacy) {
    await prisma.attempt.deleteMany({
      where: { quizAssignment: { quizTemplateId: legacy.id } },
    });
    await prisma.quizAssignment.deleteMany({ where: { quizTemplateId: legacy.id } });
    await prisma.quizTemplate.delete({ where: { id: legacy.id } });
    console.log(`Removed superseded placeholder quiz "${LEGACY_QUIZ_TITLE}".`);
  }

  let cohort = await prisma.cohort.findFirst({ where: { teacherId: teacher.id, name: COHORT_NAME } });
  if (!cohort) {
    cohort = await prisma.cohort.create({ data: { teacherId: teacher.id, name: COHORT_NAME } });
  }

  let quiz = await prisma.quizTemplate.findFirst({ where: { teacherId: teacher.id, title: QUIZ_TITLE } });
  if (!quiz) {
    quiz = await prisma.quizTemplate.create({
      data: {
        teacherId: teacher.id,
        title: QUIZ_TITLE,
        language: "en",
        // Schema only models easy/medium/hard (F-10b); the PRD fixture's
        // own "medium-high" label doesn't fit that enum, so this rounds
        // up given the question depth (strict mode, tracing API).
        difficulty: "hard",
        durationMinutes: 20,
        passScore: 60,
        passFeedbackText:
          "Nice work — you have a solid grasp of Playwright's core mechanics. Move on to the next module.",
        failFeedbackText:
          "You are not quite there yet — review Actionability, Locators, and Network Interception in the docs, then retake this quiz.",
        revealAnswerKey: false,
        status: "published",
        questions: {
          create: QUESTIONS.map((q, i) => ({
            text: q.text,
            type: "single",
            sourceReference: q.sourceReference,
            sortOrder: i,
            options: { create: q.options },
          })),
        },
      },
    });
  } else if (quiz.status !== "published") {
    quiz = await prisma.quizTemplate.update({ where: { id: quiz.id }, data: { status: "published" } });
  }

  let assignment = await prisma.quizAssignment.findFirst({
    where: { quizTemplateId: quiz.id, cohortId: cohort.id },
  });
  if (!assignment) {
    assignment = await prisma.quizAssignment.create({
      data: {
        quizTemplateId: quiz.id,
        cohortId: cohort.id,
        accessCode: await generateUniqueAccessCode(prisma),
      },
    });
  }

  await prisma.$disconnect();

  console.log(`\nSample exam ready:`);
  console.log(`  cohort:      ${COHORT_NAME}`);
  console.log(`  quiz:        ${QUIZ_TITLE} (5 questions, published)`);
  console.log(`  access code: ${assignment.accessCode}`);
  console.log(`\n  Take it at:  http://localhost:5173/join`);
  console.log(`  (or from your phone: http://<your-lan-ip>:5173/join)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
