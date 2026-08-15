import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AttemptQuestionsResponse,
  AttemptResultResponse,
  AttemptReviewResponse,
} from "@bohan-peta/shared-types";
import type {
  AnswerOption as AnswerOptionRow,
  Attempt as AttemptRow,
  AttemptEndedReason,
  Question as QuestionRow,
  QuizAssignment,
  QuizTemplate,
} from "../../generated/prisma";

type QuestionWithOptions = QuestionRow & { options: AnswerOptionRow[] };
type AttemptWithRelations = AttemptRow & { quizAssignment: QuizAssignment & { quizTemplate: QuizTemplate } };

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

@Injectable()
export class AttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  async getQuestions(attemptId: string): Promise<AttemptQuestionsResponse> {
    const attempt = await this.ensureFinalized(await this.loadAttemptOrThrow(attemptId));
    const questions = await this.loadQuestionsById(attempt.questionOrder);
    const answersByQuestion = await this.loadAnswersByQuestion(attemptId);

    return {
      questions: attempt.questionOrder.map((qid) => {
        const q = questions.get(qid)!;
        return {
          id: q.id,
          text: q.text,
          type: q.type,
          // Client-safe: never send which option is correct while the
          // exam is in progress.
          options: q.options.map((o) => ({ id: o.id, text: o.text })),
          selectedOptionIds: answersByQuestion.get(qid) ?? [],
        };
      }),
      startedAt: attempt.startedAt.toISOString(),
      durationMinutes: attempt.quizAssignment.quizTemplate.durationMinutes,
      endedReason: attempt.endedReason,
    };
  }

  async saveAnswer(attemptId: string, questionId: string, selectedOptionIds: string[]): Promise<{ saved: true }> {
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
      update: { selectedOptionIds },
      create: { attemptId, questionId, selectedOptionIds },
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
      const selected = answersByQuestion.get(qid) ?? [];
      return {
        id: q.id,
        text: q.text,
        type: q.type,
        options: q.options.map((o) => ({
          id: o.id,
          text: o.text,
          ...(template.revealAnswerKey ? { isCorrect: o.isCorrect } : {}),
        })),
        selectedOptionIds: selected,
        correct: isCorrectAnswer(q, selected),
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
    const answersByQuestion = await this.loadAnswersByQuestion(attempt.id);

    let correctCount = 0;
    for (const qid of attempt.questionOrder) {
      const q = questions.get(qid);
      if (q && isCorrectAnswer(q, answersByQuestion.get(qid) ?? [])) correctCount++;
    }
    const total = attempt.questionOrder.length;
    const score = total > 0 ? Math.round((correctCount / total) * 10000) / 100 : 0;

    return this.prisma.attempt.update({
      where: { id: attempt.id },
      data: { submittedAt: new Date(), score, endedReason },
      include: { quizAssignment: { include: { quizTemplate: true } } },
    });
  }

  private async loadAttemptOrThrow(attemptId: string): Promise<AttemptWithRelations> {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { quizAssignment: { include: { quizTemplate: true } } },
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

  private async loadAnswersByQuestion(attemptId: string): Promise<Map<string, string[]>> {
    const answers = await this.prisma.attemptAnswer.findMany({ where: { attemptId } });
    return new Map(answers.map((a) => [a.questionId, a.selectedOptionIds]));
  }
}
