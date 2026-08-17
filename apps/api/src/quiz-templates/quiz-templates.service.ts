import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
  QuestionResponse,
  QuizTemplateResponse,
  QuizTemplateSummaryResponse,
} from "@bohan-peta/shared-types";
import type {
  AnswerOption as AnswerOptionRow,
  Question as QuestionRow,
  QuizTemplate as QuizTemplateRow,
} from "../../generated/prisma";
import { CreateQuizTemplateDto } from "./dto/create-quiz-template.dto";
import { UpdateQuizTemplateDto } from "./dto/update-quiz-template.dto";
import { UpdateQuizGradingDto } from "./dto/update-quiz-grading.dto";
import { UpdateQuizStatusDto } from "./dto/update-quiz-status.dto";
import { UpsertQuestionDto } from "./dto/upsert-question.dto";

const MIN_QUESTIONS_TO_PUBLISH = 3;

type QuestionWithOptions = QuestionRow & { options: AnswerOptionRow[] };

function toTemplateBase(row: QuizTemplateRow) {
  return {
    id: row.id,
    teacherId: row.teacherId,
    title: row.title,
    language: row.language,
    difficulty: row.difficulty,
    aiGenerated: row.aiGenerated,
    status: row.status,
    teacherNotes: row.teacherNotes,
    durationMinutes: row.durationMinutes,
    passScore: Number(row.passScore),
    passFeedbackText: row.passFeedbackText,
    failFeedbackText: row.failFeedbackText,
    revealAnswerKey: row.revealAnswerKey,
    createdAt: row.createdAt.toISOString(),
  };
}

function toQuestionResponse(row: QuestionWithOptions): QuestionResponse {
  return {
    id: row.id,
    quizTemplateId: row.quizTemplateId,
    text: row.text,
    type: row.type,
    sourceReference: row.sourceReference,
    isActive: row.isActive,
    teacherNotes: row.teacherNotes,
    imageUrl: row.imageUrl,
    imagePrompt: row.imagePrompt,
    sortOrder: row.sortOrder,
    options: row.options.map((o) => ({
      id: o.id,
      questionId: o.questionId,
      text: o.text,
      isCorrect: o.isCorrect,
    })),
  };
}

/** Default pass/fail feedback text for newly created quizzes — teachers can freely edit or clear it afterward. */
function defaultFeedback(language: string): { pass: string; fail: string } {
  if (language === "he") {
    return { pass: "עברת", fail: "לא עברת את הבוחן" };
  }
  return { pass: "You passed!", fail: "You did not pass the exam." };
}

function validateOptionCorrectness(type: "single" | "multi", options: { isCorrect: boolean }[]) {
  const correctCount = options.filter((o) => o.isCorrect).length;
  if (correctCount === 0) {
    throw new BadRequestException("At least one option must be marked correct");
  }
  if (type === "single" && correctCount !== 1) {
    throw new BadRequestException("A Single Choice question must have exactly one correct option");
  }
}

@Injectable()
export class QuizTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(teacherId: string, dto: CreateQuizTemplateDto): Promise<QuizTemplateResponse> {
    const language = dto.language ?? "en";
    const feedback = defaultFeedback(language);
    const row = await this.prisma.quizTemplate.create({
      data: {
        teacherId,
        title: dto.title,
        language,
        difficulty: dto.difficulty ?? null,
        passFeedbackText: feedback.pass,
        failFeedbackText: feedback.fail,
      },
    });
    return { ...toTemplateBase(row), questions: [] };
  }

  async findAllForTeacher(teacherId: string): Promise<QuizTemplateSummaryResponse[]> {
    const rows = await this.prisma.quizTemplate.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { questions: { where: { isActive: true } } } } },
    });
    return rows.map((row) => ({ ...toTemplateBase(row), questionCount: row._count.questions }));
  }

  async findOneForTeacher(teacherId: string, id: string): Promise<QuizTemplateResponse> {
    const row = await this.getOwnedTemplateOrThrow(teacherId, id);
    return {
      ...toTemplateBase(row),
      questions: row.questions.map(toQuestionResponse),
    };
  }

  async update(teacherId: string, id: string, dto: UpdateQuizTemplateDto): Promise<QuizTemplateResponse> {
    await this.getOwnedTemplateOrThrow(teacherId, id);
    const row = await this.prisma.quizTemplate.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.language !== undefined ? { language: dto.language } : {}),
        ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
      },
    });
    return this.findOneForTeacher(teacherId, row.id);
  }

  /** F-04/F-27/F-28 — editable at any time regardless of Edit/Execution status (3.7). */
  async updateGrading(
    teacherId: string,
    id: string,
    dto: UpdateQuizGradingDto,
  ): Promise<QuizTemplateResponse> {
    await this.getOwnedTemplateOrThrow(teacherId, id);
    await this.prisma.quizTemplate.update({
      where: { id },
      data: {
        ...(dto.durationMinutes !== undefined ? { durationMinutes: dto.durationMinutes } : {}),
        ...(dto.passScore !== undefined ? { passScore: dto.passScore } : {}),
        ...(dto.passFeedbackText !== undefined ? { passFeedbackText: dto.passFeedbackText } : {}),
        ...(dto.failFeedbackText !== undefined ? { failFeedbackText: dto.failFeedbackText } : {}),
        ...(dto.revealAnswerKey !== undefined ? { revealAnswerKey: dto.revealAnswerKey } : {}),
      },
    });
    return this.findOneForTeacher(teacherId, id);
  }

  /**
   * Edit Mode <-> Execution Mode (PRD 3.4). Execution -> Edit is always
   * available; Edit -> Execution ("publish") requires >= 3 questions,
   * each with a valid correct-option configuration.
   */
  async updateStatus(
    teacherId: string,
    id: string,
    dto: UpdateQuizStatusDto,
  ): Promise<QuizTemplateResponse> {
    const template = await this.getOwnedTemplateOrThrow(teacherId, id);

    if (dto.status === "published") {
      const active = template.questions.filter((q) => q.isActive);
      if (active.length < MIN_QUESTIONS_TO_PUBLISH) {
        throw new BadRequestException(
          `A quiz needs at least ${MIN_QUESTIONS_TO_PUBLISH} questions to publish (has ${active.length})`,
        );
      }
      for (const q of active) {
        validateOptionCorrectness(q.type, q.options);
      }
    }

    await this.prisma.quizTemplate.update({ where: { id }, data: { status: dto.status } });
    return this.findOneForTeacher(teacherId, id);
  }

  async addQuestion(
    teacherId: string,
    quizTemplateId: string,
    dto: UpsertQuestionDto,
  ): Promise<QuestionResponse> {
    await this.getOwnedTemplateOrThrow(teacherId, quizTemplateId);
    validateOptionCorrectness(dto.type, dto.options);

    const last = await this.prisma.question.findFirst({
      where: { quizTemplateId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (last?.sortOrder ?? -1) + 1;

    const row = await this.prisma.question.create({
      data: {
        quizTemplateId,
        text: dto.text,
        type: dto.type,
        sortOrder,
        options: { create: dto.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) },
      },
      include: { options: true },
    });
    return toQuestionResponse(row);
  }

  async updateQuestion(
    teacherId: string,
    quizTemplateId: string,
    questionId: string,
    dto: UpsertQuestionDto,
  ): Promise<QuestionResponse> {
    await this.getOwnedTemplateOrThrow(teacherId, quizTemplateId);
    await this.getOwnedQuestionOrThrow(quizTemplateId, questionId);
    validateOptionCorrectness(dto.type, dto.options);

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.answerOption.deleteMany({ where: { questionId } });
      return tx.question.update({
        where: { id: questionId },
        data: {
          text: dto.text,
          type: dto.type,
          options: { create: dto.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) },
        },
        include: { options: true },
      });
    });
    return toQuestionResponse(row);
  }

  /** Flags a quiz as having at least one AI-generated question (informational only — doesn't gate anything). */
  async markAiGenerated(teacherId: string, quizTemplateId: string): Promise<void> {
    await this.getOwnedTemplateOrThrow(teacherId, quizTemplateId);
    await this.prisma.quizTemplate.update({ where: { id: quizTemplateId }, data: { aiGenerated: true } });
  }

  async deleteQuestion(teacherId: string, quizTemplateId: string, questionId: string): Promise<void> {
    await this.getOwnedTemplateOrThrow(teacherId, quizTemplateId);
    await this.getOwnedQuestionOrThrow(quizTemplateId, questionId);
    // TODO(PRD 5.4): once a question has recorded AttemptAnswers, this
    // should soft-delete (is_active=false) instead of hard-deleting, to
    // keep historical attempts' answers intact and queryable. Not yet
    // enforced — deleting a question currently orphans any AttemptAnswer
    // rows that reference it (the FK has no cascade), which would throw
    // rather than silently corrupt data, but the right fix is the
    // soft-delete switch, not catching that error.
    await this.prisma.question.delete({ where: { id: questionId } });
  }

  /**
   * Hard delete, same as cohorts — cascades through this quiz's
   * assignments and any attempts/answers recorded against them, plus its
   * questions/options/sources (already `onDelete: Cascade` in schema).
   */
  async remove(teacherId: string, id: string): Promise<void> {
    await this.getOwnedTemplateOrThrow(teacherId, id);
    const assignments = await this.prisma.quizAssignment.findMany({
      where: { quizTemplateId: id },
      select: { id: true },
    });
    const assignmentIds = assignments.map((a) => a.id);

    await this.prisma.$transaction([
      this.prisma.attempt.deleteMany({ where: { quizAssignmentId: { in: assignmentIds } } }),
      this.prisma.quizAssignment.deleteMany({ where: { quizTemplateId: id } }),
      this.prisma.quizTemplate.delete({ where: { id } }),
    ]);
  }

  private async getOwnedTemplateOrThrow(teacherId: string, id: string) {
    const row = await this.prisma.quizTemplate.findFirst({
      where: { id, teacherId },
      include: { questions: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { options: true } } },
    });
    if (!row) {
      throw new NotFoundException("Quiz template not found");
    }
    return row;
  }

  private async getOwnedQuestionOrThrow(quizTemplateId: string, questionId: string) {
    const row = await this.prisma.question.findFirst({ where: { id: questionId, quizTemplateId } });
    if (!row) {
      throw new NotFoundException("Question not found");
    }
    return row;
  }
}
