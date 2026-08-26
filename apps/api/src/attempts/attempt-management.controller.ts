import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentTeacher, CurrentTeacherPayload } from "../auth/current-teacher.decorator";
import { AttemptsService } from "./attempts.service";
import { UpdateAttemptGradingDto } from "./dto/update-attempt-grading.dto";

// Teacher-only surface over attempts — distinct from AttemptsController,
// which is deliberately public (the attempt UUID itself is the bearer
// credential for the student-facing exam/review flow). Grading and
// deletion are admin actions and must be JWT-guarded + ownership-checked.
@UseGuards(JwtAuthGuard)
@Controller("attempts")
export class AttemptManagementController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get(":id/grading")
  getGrading(@CurrentTeacher() teacher: CurrentTeacherPayload, @Param("id") id: string) {
    return this.attempts.getGradingForTeacher(teacher.id, id);
  }

  @Patch(":id/grading")
  updateGrading(
    @CurrentTeacher() teacher: CurrentTeacherPayload,
    @Param("id") id: string,
    @Body() dto: UpdateAttemptGradingDto,
  ) {
    return this.attempts.updateGrading(teacher.id, id, dto.overrides, dto.notifyStudent);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentTeacher() teacher: CurrentTeacherPayload, @Param("id") id: string) {
    return this.attempts.removeAttempt(teacher.id, id);
  }
}
