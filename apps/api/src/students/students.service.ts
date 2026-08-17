import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { JoinAttemptResponse } from "@bohan-peta/shared-types";
import { shuffled } from "../common/shuffle.util";
import { isValidIsraeliNationalId } from "./national-id.util";
import { JoinAttemptDto } from "./dto/join-attempt.dto";

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async join(dto: JoinAttemptDto): Promise<JoinAttemptResponse> {
    if (!isValidIsraeliNationalId(dto.nationalId)) {
      throw new BadRequestException("Invalid national ID");
    }

    const assignment = await this.prisma.quizAssignment.findUnique({
      where: { accessCode: dto.accessCode },
      include: {
        quizTemplate: {
          include: {
            questions: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              include: { options: true },
            },
          },
        },
      },
    });
    if (!assignment) {
      throw new NotFoundException("Invalid exam token");
    }

    const now = new Date();
    if (assignment.openAt && now < assignment.openAt) {
      throw new BadRequestException("This exam is not open yet");
    }
    if (assignment.closeAt && now > assignment.closeAt) {
      throw new BadRequestException("This exam is closed");
    }
    if (assignment.quizTemplate.status !== "published") {
      throw new BadRequestException("This exam is not currently available");
    }
    if (assignment.quizTemplate.questions.length === 0) {
      throw new BadRequestException("This exam has no questions");
    }

    // v2.5 (F-03 fix): look up any existing Student by national_id rather
    // than blindly inserting a new row, so a re-registration under a new
    // student_id can't bypass the single/max-attempt rule below.
    const student = await this.prisma.student.upsert({
      where: { nationalId: dto.nationalId },
      update: { firstName: dto.firstName, lastName: dto.lastName, email: dto.email },
      create: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        nationalId: dto.nationalId,
        email: dto.email,
      },
    });

    const priorAttempts = await this.prisma.attempt.count({
      where: { quizAssignmentId: assignment.id, studentId: student.id },
    });
    if (priorAttempts >= assignment.maxAttempts) {
      throw new ConflictException("You have already attempted this exam");
    }

    const questionIds = assignment.quizTemplate.questions.map((q) => q.id);
    const questionOrder = assignment.shuffle ? shuffled(questionIds) : questionIds;

    // Completes what the assignment's "shuffle" toggle already promises
    // ("shuffle question/answer order") — captured once here, same
    // stability rationale as questionOrder (F-04d), so a question's
    // option order doesn't rearrange itself on navigation/resume.
    const optionOrder: Record<string, string[]> = {};
    for (const q of assignment.quizTemplate.questions) {
      const optionIds = q.options.map((o) => o.id);
      optionOrder[q.id] = assignment.shuffle ? shuffled(optionIds) : optionIds;
    }

    const attempt = await this.prisma.attempt.create({
      data: {
        quizAssignmentId: assignment.id,
        studentId: student.id,
        questionOrder,
        optionOrder,
      },
    });

    return {
      attemptId: attempt.id,
      quizTitle: assignment.quizTemplate.title,
      durationMinutes: assignment.quizTemplate.durationMinutes,
      questionCount: questionOrder.length,
    };
  }
}
