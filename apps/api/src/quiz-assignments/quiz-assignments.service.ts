import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { QuizAssignmentResponse } from "@bohan-peta/shared-types";
import { CreateQuizAssignmentDto } from "./dto/create-quiz-assignment.dto";
import type { QuizAssignment as QuizAssignmentRow } from "../../generated/prisma";

const ACCESS_CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 10;

function toResponse(row: QuizAssignmentRow, quizTemplateTitle: string): QuizAssignmentResponse {
  return {
    id: row.id,
    quizTemplateId: row.quizTemplateId,
    cohortId: row.cohortId,
    accessCode: row.accessCode,
    openAt: row.openAt ? row.openAt.toISOString() : null,
    closeAt: row.closeAt ? row.closeAt.toISOString() : null,
    maxAttempts: row.maxAttempts,
    shuffle: row.shuffle,
    quizTemplateTitle,
  };
}

@Injectable()
export class QuizAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    teacherId: string,
    cohortId: string,
    dto: CreateQuizAssignmentDto,
  ): Promise<QuizAssignmentResponse> {
    await this.getOwnedCohortOrThrow(teacherId, cohortId);
    const quizTemplate = await this.prisma.quizTemplate.findFirst({
      where: { id: dto.quizTemplateId, teacherId },
    });
    if (!quizTemplate) {
      throw new NotFoundException("Quiz template not found");
    }
    // Belt-and-suspenders: the teacher UI only offers published quizzes
    // in the assignment form, but that's a client-side filter — without
    // this check, a direct API call could still assign a draft quiz,
    // which is the only way a student ever hits "exam not available".
    if (quizTemplate.status !== "published") {
      throw new BadRequestException("Quiz must be published before it can be assigned to a cohort");
    }

    const accessCode = await this.generateUniqueAccessCode();

    const row = await this.prisma.quizAssignment.create({
      data: {
        quizTemplateId: dto.quizTemplateId,
        cohortId,
        accessCode,
        openAt: dto.openAt ? new Date(dto.openAt) : null,
        closeAt: dto.closeAt ? new Date(dto.closeAt) : null,
        maxAttempts: dto.maxAttempts ?? 1,
        shuffle: dto.shuffle ?? true,
      },
    });
    return toResponse(row, quizTemplate.title);
  }

  async findAllForCohort(teacherId: string, cohortId: string): Promise<QuizAssignmentResponse[]> {
    await this.getOwnedCohortOrThrow(teacherId, cohortId);
    const rows = await this.prisma.quizAssignment.findMany({
      where: { cohortId },
      orderBy: { id: "desc" },
      include: { quizTemplate: { select: { title: true } } },
    });
    return rows.map((row) => toResponse(row, row.quizTemplate.title));
  }

  async remove(teacherId: string, cohortId: string, assignmentId: string): Promise<void> {
    await this.getOwnedCohortOrThrow(teacherId, cohortId);
    const assignment = await this.prisma.quizAssignment.findFirst({
      where: { id: assignmentId, cohortId },
    });
    if (!assignment) {
      throw new NotFoundException("Assignment not found");
    }

    await this.prisma.$transaction([
      this.prisma.attempt.deleteMany({ where: { quizAssignmentId: assignmentId } }),
      this.prisma.quizAssignment.delete({ where: { id: assignmentId } }),
    ]);
  }

  private async getOwnedCohortOrThrow(teacherId: string, cohortId: string) {
    const cohort = await this.prisma.cohort.findFirst({ where: { id: cohortId, teacherId } });
    if (!cohort) {
      throw new NotFoundException("Cohort not found");
    }
    return cohort;
  }

  private async generateUniqueAccessCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = Math.floor(Math.random() * 10 ** ACCESS_CODE_LENGTH)
        .toString()
        .padStart(ACCESS_CODE_LENGTH, "0");
      const existing = await this.prisma.quizAssignment.findUnique({ where: { accessCode: code } });
      if (!existing) {
        return code;
      }
    }
    throw new Error("Could not generate a unique access code — this should be exceedingly rare");
  }
}
