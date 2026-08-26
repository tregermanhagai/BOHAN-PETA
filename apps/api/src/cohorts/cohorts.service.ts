import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CohortResponse } from "@bohan-peta/shared-types";
import { CreateCohortDto } from "./dto/create-cohort.dto";
import { UpdateCohortDto } from "./dto/update-cohort.dto";
import type { Cohort as CohortRow } from "../../generated/prisma";

function assertValidRange(startDate: string | null, endDate: string | null): void {
  // ISO8601 (YYYY-MM-DD) date strings compare lexicographically in
  // chronological order, so a plain string comparison is enough here.
  if (startDate && endDate && endDate < startDate) {
    throw new BadRequestException("endDate must not be before startDate");
  }
}

function toResponse(row: CohortRow): CohortResponse {
  return {
    id: row.id,
    teacherId: row.teacherId,
    name: row.name,
    description: row.description,
    startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : null,
    endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : null,
    archived: row.archived,
  };
}

@Injectable()
export class CohortsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(teacherId: string, dto: CreateCohortDto): Promise<CohortResponse> {
    assertValidRange(dto.startDate ?? null, dto.endDate ?? null);
    const row = await this.prisma.cohort.create({
      data: {
        teacherId,
        name: dto.name,
        description: dto.description ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
    return toResponse(row);
  }

  async findAllForTeacher(teacherId: string): Promise<CohortResponse[]> {
    const rows = await this.prisma.cohort.findMany({
      where: { teacherId },
      orderBy: { name: "asc" },
    });
    return rows.map(toResponse);
  }

  async findOneForTeacher(teacherId: string, id: string): Promise<CohortResponse> {
    const row = await this.prisma.cohort.findFirst({ where: { id, teacherId } });
    if (!row) {
      throw new NotFoundException("Cohort not found");
    }
    return toResponse(row);
  }

  async update(teacherId: string, id: string, dto: UpdateCohortDto): Promise<CohortResponse> {
    const existing = await this.findOneForTeacher(teacherId, id);
    const resolvedStartDate = dto.startDate !== undefined ? dto.startDate : existing.startDate;
    const resolvedEndDate = dto.endDate !== undefined ? dto.endDate : existing.endDate;
    assertValidRange(resolvedStartDate, resolvedEndDate);

    const row = await this.prisma.cohort.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: dto.startDate ? new Date(dto.startDate) : null }
          : {}),
        ...(dto.endDate !== undefined ? { endDate: dto.endDate ? new Date(dto.endDate) : null } : {}),
        ...(dto.archived !== undefined ? { archived: dto.archived } : {}),
      },
    });
    return toResponse(row);
  }

  /**
   * Hard delete, unlike archive — cascades through this cohort's
   * assignments and any attempts/answers recorded against them. There's
   * no PRD requirement to preserve this once a teacher explicitly asks
   * to delete it (archive remains the reversible option for "hide but
   * keep the history").
   */
  async remove(teacherId: string, id: string): Promise<void> {
    await this.findOneForTeacher(teacherId, id);
    const assignments = await this.prisma.quizAssignment.findMany({
      where: { cohortId: id },
      select: { id: true },
    });
    const assignmentIds = assignments.map((a) => a.id);

    await this.prisma.$transaction([
      this.prisma.attempt.deleteMany({ where: { quizAssignmentId: { in: assignmentIds } } }),
      this.prisma.quizAssignment.deleteMany({ where: { cohortId: id } }),
      this.prisma.cohort.delete({ where: { id } }),
    ]);
  }
}
