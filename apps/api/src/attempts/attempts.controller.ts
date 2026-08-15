import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from "@nestjs/common";
import { AttemptsService } from "./attempts.service";
import { SaveAnswerDto } from "./dto/save-answer.dto";

// Public — no JWT guard. The Attempt UUID itself is the bearer credential
// for an in-progress or already-submitted attempt (unguessable v4 UUID,
// same trust model as the review link — see PRD 3.1 design note).
@Controller("attempts")
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get(":id/questions")
  getQuestions(@Param("id") id: string) {
    return this.attempts.getQuestions(id);
  }

  @Put(":id/answers/:questionId")
  saveAnswer(@Param("id") id: string, @Param("questionId") questionId: string, @Body() dto: SaveAnswerDto) {
    return this.attempts.saveAnswer(id, questionId, dto.selectedOptionIds);
  }

  @Post(":id/submit")
  @HttpCode(HttpStatus.OK)
  submit(@Param("id") id: string) {
    return this.attempts.submit(id);
  }

  @Post(":id/auto-submit")
  @HttpCode(HttpStatus.OK)
  autoSubmit(@Param("id") id: string) {
    return this.attempts.autoSubmit(id);
  }

  @Get(":id/review")
  getReview(@Param("id") id: string) {
    return this.attempts.getReview(id);
  }
}
