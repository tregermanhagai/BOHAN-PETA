import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { GeminiService } from "../ai-generation/gemini.service";
import { reorderById } from "../common/shuffle.util";
import type {
  AttemptQuestionsResponse,
  AttemptResultResponse,
  AttemptReviewResponse,
} from "@bohan-peta/shared-types";
import type {
  AnswerOption as AnswerOptionRow,
  Attempt as AttemptRow,
  AttemptAnswer as AttemptAnswerRow,
  AttemptEndedReason,
  Question as QuestionRow,
  QuizAssignment,
  QuizTemplate,
  Student,
} from "../../generated/prisma";

type QuestionWithOptions = QuestionRow & { options: AnswerOptionRow[] };
type AttemptWithRelations = AttemptRow & {
  quizAssignment: QuizAssignment & { quizTemplate: QuizTemplate };
  student: Student;
};

/** Every question is worth this many points if it was deleted mid-attempt
 *  before being answered (so it's missing from the loaded question map) —
 *  matches the pre-existing behavior where the denominator was simply
 *  questionOrder.length regardless of whether each question still existed. */
const FALLBACK_POINTS_FOR_MISSING_QUESTION = 1;

/**
 * F-13a (v2.5): both Single Choice and Multiple Select are scored the
 * same way — the student's selected option set must exactly match the
 * correct-option set. No partial credit, and no need to branch on
 * question.type at all.
 */
function isCorrectAnswer(question: QuestionWithOptions, selectedOptionIds: string[]): boolean {
  const correctIds = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
  const selected = new Set(selectedOptionIds);
  if (correctIds.size !== selected.size) return false;
  for (const id of correctIds) {
    if (!selected.has(id)) return false;
  }
  return true;
}

/** Attempt.optionOrder is a Prisma Json column: { [questionId]: optionId[] }, captured once at join (students.service.ts). */
function optionOrderFor(attempt: AttemptRow, questionId: string): string[] {
  const map = attempt.optionOrder as Record<string, string[]> | null;
  return map?.[questionId] ?? [];
}

@Injectable()
export class AttemptsService {
  private readonly logger = new Logger(AttemptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly gemini: GeminiService,
  ) {}

  async getQuestions(attemptId: string): Promise<AttemptQuestionsResponse> {
    const attempt = await this.ensureFinalized(await this.loadAttemptOrThrow(attemptId));
    const questions = await this.loadQuestionsById(attempt.questionOrder);
    const answersByQuestion = await this.loadAnswersByQuestion(attemptId);

    return {
      questions: attempt.questionOrder.map((qid) => {
        const q = questions.get(qid)!;
        const orderedOptions = reorderById(q.options, optionOrderFor(attempt, qid));
        const answer = answersByQuestion.get(qid);
        return {
          id: q.id,
          text: q.text,
          type: q.type,
          // Client-safe: never send which option is correct while the
          // exam is in progress.
          options: orderedOptions.map((o) => ({ id: o.id, text: o.text })),
          selectedOptionIds: answer?.selectedOptionIds ?? [],
          answerText: answer?.answerText ?? null,
          points: q.points,
        };
      }),
      startedAt: attempt.startedAt.toISOString(),
      durationMinutes: attempt.quizAssignment.quizTemplate.durationMinutes,
      endedReason: attempt.endedReason,
    };
  }

  async saveAnswer(
    attemptId: string,
    questionId: string,
    selectedOptionIds: string[],
    answerText?: string,
  ): Promise<{ saved: true }> {
    const attempt = await this.ensureFinalized(await this.loadAttemptOrThrow(attemptId));
    if (attempt.submittedAt) {
      throw new ConflictException({
        message: "This exam has already ended",
        endedReason: attempt.endedReason,
      });
    }
    if (!attempt.questionOrder.includes(questionId)) {
      throw new NotFoundException("Question not part of this attempt");
    }

    await this.prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: { selectedOptionIds, answerText: answerText ?? null },
      create: { attemptId, questionId, selectedOptionIds, answerText: answerText ?? null },
    });
    return { saved: true };
  }

  async submit(attemptId: string): Promise<AttemptResultResponse> {
    let attempt = await this.ensureFinalized(await this.loadAttemptOrThrow(attemptId));
    if (!attempt.submittedAt) {
      attempt = await this.finalizeAttempt(attempt, "submitted");
    }
    return this.buildResult(attempt);
  }

  async autoSubmit(attemptId: string): Promise<AttemptResultResponse> {
    let attempt = await this.ensureFinalized(await this.loadAttemptOrThrow(attemptId));
    if (!attempt.submittedAt) {
      attempt = await this.finalizeAttempt(attempt, "focus_loss");
    }
    return this.buildResult(attempt);
  }

  async getReview(attemptId: string): Promise<AttemptReviewResponse> {
    const attempt = await this.ensureFinalized(await this.loadAttemptOrThrow(attemptId));
    if (!attempt.submittedAt) {
      throw new BadRequestException("This exam is still in progress");
    }
    const template = attempt.quizAssignment.quizTemplate;
    const questions = await this.loadQuestionsById(attempt.questionOrder);
    const answersByQuestion = await this.loadAnswersByQuestion(attemptId);

    const reviewQuestions = attempt.questionOrder.map((qid) => {
      const q = questions.get(qid)!;
      const answer = answersByQuestion.get(qid);
      const orderedOptions = reorderById(q.options, optionOrderFor(attempt, qid));

      if (q.type === "open") {
        const pointsEarned = answer?.aiScore ? Number(answer.aiScore) : 0;
        return {
          id: q.id,
          text: q.text,
          type: q.type,
          options: [],
          selectedOptionIds: [],
          answerText: answer?.answerText ?? null,
          points: q.points,
          pointsEarned,
          // Only ever shown once the quiz reveals the answer key — same
          // gating as AnswerOption.isCorrect below.
          ...(template.revealAnswerKey ? { aiFeedback: answer?.aiFeedback ?? null } : {}),
          correct: pointsEarned === q.points,
        };
      }

      const selected = answer?.selectedOptionIds ?? [];
      const correct = isCorrectAnswer(q, selected);
      return {
        id: q.id,
        text: q.text,
        type: q.type,
        options: orderedOptions.map((o) => ({
          id: o.id,
          text: o.text,
          ...(template.revealAnswerKey ? { isCorrect: o.isCorrect } : {}),
        })),
        selectedOptionIds: selected,
        answerText: null,
        points: q.points,
        pointsEarned: correct ? q.points : 0,
        correct,
      };
    });

    const score = Number(attempt.score);
    const passed = score >= Number(template.passScore);
    return {
      score,
      passed,
      feedbackText: (passed ? template.passFeedbackText : template.failFeedbackText) ?? "",
      endedReason: attempt.endedReason!,
      revealAnswerKey: template.revealAnswerKey,
      questions: reviewQuestions,
    };
  }

  private buildResult(attempt: AttemptWithRelations): AttemptResultResponse {
    const template = attempt.quizAssignment.quizTemplate;
    const score = Number(attempt.score);
    const passed = score >= Number(template.passScore);
    return {
      score,
      passed,
      feedbackText: (passed ? template.passFeedbackText : template.failFeedbackText) ?? "",
      endedReason: attempt.endedReason!,
      reviewToken: attempt.id,
    };
  }

  /**
   * Server-side time enforcement (3.7, v2.5): authoritative regardless of
   * what the client's own countdown shows. Any read/write on an attempt
   * first checks whether it's run past duration_minutes and, if so,
   * finalizes it right here rather than waiting for a background sweep.
   */
  private async ensureFinalized(attempt: AttemptWithRelations): Promise<AttemptWithRelations> {
    if (attempt.submittedAt) return attempt;
    const deadline = attempt.startedAt.getTime() + attempt.quizAssignment.quizTemplate.durationMinutes * 60_000;
    if (Date.now() > deadline) {
      return this.finalizeAttempt(attempt, "time_expired");
    }
    return attempt;
  }

  private async finalizeAttempt(
    attempt: AttemptWithRelations,
    endedReason: AttemptEndedReason,
  ): Promise<AttemptWithRelations> {
    const questions = await this.loadQuestionsById(attempt.questionOrder);

    // Best-effort — grades every open question's answerText via Gemini and
    // persists aiScore/aiFeedback onto its AttemptAnswer row. Must never
    // block finalize: on any failure this just logs and leaves those
    // questions ungraded (scored as 0 below), same fire-and-forget
    // philosophy as the result email a few lines down.
    await this.gradeOpenQuestions(attempt.id, attempt.quizAssignment.quizTemplate.language, questions);
    const answersByQuestion = await this.loadAnswersByQuestion(attempt.id);

    let earned = 0;
    let maxTotal = 0;
    for (const qid of attempt.questionOrder) {
      const q = questions.get(qid);
      if (!q) {
        // Question was deleted mid-attempt before being answered — still
        // counts toward the denominator, same as the old
        // questionOrder.length-based total did unconditionally.
        maxTotal += FALLBACK_POINTS_FOR_MISSING_QUESTION;
        continue;
      }
      maxTotal += q.points;
      const answer = answersByQuestion.get(qid);
      if (q.type === "open") {
        earned += answer?.aiScore != null ? Number(answer.aiScore) : 0;
      } else if (isCorrectAnswer(q, answer?.selectedOptionIds ?? [])) {
        earned += q.points;
      }
    }
    const score = maxTotal > 0 ? Math.round((earned / maxTotal) * 10000) / 100 : 0;

    const finalized = await this.prisma.attempt.update({
      where: { id: attempt.id },
      data: { submittedAt: new Date(), score, endedReason },
      include: { quizAssignment: { include: { quizTemplate: true } }, student: true },
    });

    if (finalized.student.email) {
      const passed = score >= Number(finalized.quizAssignment.quizTemplate.passScore);
      // Best-effort: a student must never see an error just because SMTP
      // is unreachable — MailService already swallows its own failures,
      // this just keeps the submit response from waiting on network I/O.
      void this.mail.sendExamResultEmail({
        to: finalized.student.email,
        studentName: `${finalized.student.firstName} ${finalized.student.lastName}`,
        quizTitle: finalized.quizAssignment.quizTemplate.title,
        score,
        passed,
        reviewToken: finalized.id,
      });
    }

    return finalized;
  }

  private async loadAttemptOrThrow(attemptId: string): Promise<AttemptWithRelations> {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { quizAssignment: { include: { quizTemplate: true } }, student: true },
    });
    if (!attempt) {
      throw new NotFoundException("Attempt not found");
    }
    return attempt;
  }

  private async loadQuestionsById(ids: string[]): Promise<Map<string, QuestionWithOptions>> {
    const questions = await this.prisma.question.findMany({
      where: { id: { in: ids } },
      include: { options: true },
    });
    return new Map(questions.map((q) => [q.id, q]));
  }

  private async loadAnswersByQuestion(attemptId: string): Promise<Map<string, AttemptAnswerRow>> {
    const answers = await this.prisma.attemptAnswer.findMany({ where: { attemptId } });
    return new Map(answers.map((a) => [a.questionId, a]));
  }

  /**
   * Grades every open question with a non-empty answerText in one Gemini
   * call and persists aiScore/aiFeedback onto each AttemptAnswer row. Any
   * failure (unconfigured, network, malformed response) is caught and
   * logged here — callers see this as "nothing got graded" (aiScore stays
   * null, scored as 0), never as a thrown error, since exam finalization
   * must always succeed regardless of AI availability.
   */
  private async gradeOpenQuestions(
    attemptId: string,
    language: string,
    questions: Map<string, QuestionWithOptions>,
  ): Promise<void> {
    const answersByQuestion = await this.loadAnswersByQuestion(attemptId);
    const items: Array<{
      questionId: string;
      questionText: string;
      referenceAnswer: string;
      studentAnswer: string;
      maxPoints: number;
    }> = [];
    for (const [qid, q] of questions) {
      if (q.type !== "open") continue;
      const text = answersByQuestion.get(qid)?.answerText?.trim();
      if (!text) continue;
      items.push({
        questionId: qid,
        questionText: q.text,
        referenceAnswer: q.referenceAnswer ?? "",
        studentAnswer: text,
        maxPoints: q.points,
      });
    }
    if (items.length === 0) return;

    let graded: Awaited<ReturnType<GeminiService["gradeOpenAnswers"]>> = [];
    try {
      graded = await this.gemini.gradeOpenAnswers(items, language);
    } catch (err) {
      this.logger.warn(
        `AI grading failed for attempt ${attemptId}, open questions will score 0: ${(err as Error).message}`,
      );
    }
    const gradedById = new Map(graded.map((g) => [g.questionId, g]));

    await Promise.all(
      items.map((item) => {
        const result = gradedById.get(item.questionId);
        return this.prisma.attemptAnswer.update({
          where: { attemptId_questionId: { attemptId, questionId: item.questionId } },
          data: { aiScore: result?.earnedPoints ?? 0, aiFeedback: result?.feedback ?? null },
        });
      }),
    );
  }
}
