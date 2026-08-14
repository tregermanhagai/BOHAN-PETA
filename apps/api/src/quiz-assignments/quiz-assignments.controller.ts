import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentTeacher, CurrentTeacherPayload } from "../auth/current-teacher.decorator";
import { QuizAssignmentsService } from "./quiz-assignments.service";
import { CreateQuizAssignmentDto } from "./dto/create-quiz-assignment.dto";

// Nested under /cohorts/:cohortId per PRD 9.3 ("POST /cohorts/:id/assignments")
// — cohort is the natural parent since assigning a quiz always happens in
// the context of a specific cohort.
@UseGuards(JwtAuthGuard)
@Controller("cohorts/:cohortId/assignments")
export class QuizAssignmentsController {
  constructor(private readonly quizAssignments: QuizAssignmentsService) {}

  @Post()
  create(
    @CurrentTeacher() teacher: CurrentTeacherPayload,
    @Param("cohortId") cohortId: string,
    @Body() dto: CreateQuizAssignmentDto,
  ) {
    return this.quizAssignments.create(teacher.id, cohortId, dto);
  }

  @Get()
  findAll(@CurrentTeacher() teacher: CurrentTeacherPayload, @Param("cohortId") cohortId: string) {
    return this.quizAssignments.findAllForCohort(teacher.id, cohortId);
  }
}
