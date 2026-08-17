import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CohortScoresResponse, ScoreRow } from "@bohan-peta/shared-types";

type AttemptWithRelations = Awaited<ReturnType<ScoresService["loadAttempts"]>>[number];

function csvCell(value: string): string {
  // RFC 4180 quoting — wrap and escape any cell that contains a comma,
  // quote, or newline; a plain cell is left untouched.
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

@Injectable()
export class ScoresService {
  constructor(private readonly prisma: PrismaService) {}

  async getScores(teacherId: string, cohortId: string): Promise<CohortScoresResponse> {
    await this.getOwnedCohortOrThrow(teacherId, cohortId);
    const attempts = await this.loadAttempts(cohortId);
    return attempts.map(toScoreRow);
  }

  async getScoresCsv(teacherId: string, cohortId: string): Promise<{ filename: string; csv: string }> {
    const cohort = await this.getOwnedCohortOrThrow(teacherId, cohortId);
    const attempts = await this.loadAttempts(cohortId);
    const rows = attempts.map(toScoreRow);

    const header = [
      "Student",
      "National ID",
      "Quiz",
      "Status",
      "Score (%)",
      "Result",
      "Started",
      "Submitted",
      "Time taken (min:sec)",
    ];
    const lines = [header.map(csvCell).join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.studentName,
          r.nationalId,
          r.quizTitle,
          r.status,
          r.score !== null ? String(Math.round(r.score)) : "",
          r.passed === null ? "" : r.passed ? "Pass" : "Fail",
          r.startedAt,
          r.submittedAt ?? "",
          r.timeTakenSeconds !== null ? formatMinSec(r.timeTakenSeconds) : "",
        ]
          .map(csvCell)
          .join(","),
      );
    }
    // Leading BOM so Excel opens the UTF-8 file correctly instead of
    // mojibake-ing Hebrew student/quiz names.
    const csv = "﻿" + lines.join("\r\n");
    const filename = `${cohort.name.replace(/[^\w\- ]+/g, "")}-scores.csv`.trim() || "scores.csv";
    return { filename, csv };
  }

  private async loadAttempts(cohortId: string) {
    return this.prisma.attempt.findMany({
      where: { quizAssignment: { cohortId } },
      include: {
        student: true,
        quizAssignment: { include: { quizTemplate: true } },
      },
      orderBy: { startedAt: "desc" },
    });
  }

  private async getOwnedCohortOrThrow(teacherId: string, cohortId: string) {
    const cohort = await this.prisma.cohort.findFirst({ where: { id: cohortId, teacherId } });
    if (!cohort) {
      throw new NotFoundException("Cohort not found");
    }
    return cohort;
  }
}

function toScoreRow(attempt: AttemptWithRelations): ScoreRow {
  const template = attempt.quizAssignment.quizTemplate;
  const score = attempt.score !== null ? Number(attempt.score) : null;
  const timeTakenSeconds = attempt.submittedAt
    ? Math.round((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000)
    : null;

  return {
    attemptId: attempt.id,
    studentId: attempt.studentId,
    studentName: `${attempt.student.firstName} ${attempt.student.lastName}`,
    nationalId: attempt.student.nationalId,
    quizAssignmentId: attempt.quizAssignmentId,
    quizTemplateId: template.id,
    quizTitle: template.title,
    status: attempt.endedReason ?? "in_progress",
    score,
    passed: score !== null ? score >= Number(template.passScore) : null,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
    timeTakenSeconds,
  };
}

function formatMinSec(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
