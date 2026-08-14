import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CohortResponse } from "@bohan-peta/shared-types";
import { CreateCohortDto } from "./dto/create-cohort.dto";
import { UpdateCohortDto } from "./dto/update-cohort.dto";
import type { Cohort as CohortRow } from "../../generated/prisma";

function toResponse(row: CohortRow): CohortResponse {
  return {
    id: row.id,
    teacherId: row.teacherId,
    name: row.name,
    startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : null,
    endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : null,
    archived: row.archived,
  };
}

@Injectable()
export class CohortsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(teacherId: string, dto: CreateCohortDto): Promise<CohortResponse> {
    const row = await this.prisma.cohort.create({
      data: {
        teacherId,
        name: dto.name,
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
    await this.findOneForTeacher(teacherId, id);
    const row = await this.prisma.cohort.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: dto.startDate ? new Date(dto.startDate) : null }
          : {}),
        ...(dto.endDate !== undefined ? { endDate: dto.endDate ? new Date(dto.endDate) : null } : {}),
        ...(dto.archived !== undefined ? { archived: dto.archived } : {}),
      },
    });
    return toResponse(row);
  }
}
