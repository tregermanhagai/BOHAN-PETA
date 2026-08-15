import { Controller, Get, Param, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentTeacher, CurrentTeacherPayload } from "../auth/current-teacher.decorator";
import { ScoresService } from "./scores.service";

@UseGuards(JwtAuthGuard)
@Controller("cohorts/:cohortId/scores")
export class ScoresController {
  constructor(private readonly scores: ScoresService) {}

  @Get()
  getScores(@CurrentTeacher() teacher: CurrentTeacherPayload, @Param("cohortId") cohortId: string) {
    return this.scores.getScores(teacher.id, cohortId);
  }

  @Get("export")
  async exportCsv(
    @CurrentTeacher() teacher: CurrentTeacherPayload,
    @Param("cohortId") cohortId: string,
    @Res() res: Response,
  ) {
    const { filename, csv } = await this.scores.getScoresCsv(teacher.id, cohortId);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="scores.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(csv);
  }
}
