import { Module } from "@nestjs/common";
import { QuizAssignmentsController } from "./quiz-assignments.controller";
import { QuizAssignmentsService } from "./quiz-assignments.service";

@Module({
  controllers: [QuizAssignmentsController],
  providers: [QuizAssignmentsService],
})
export class QuizAssignmentsModule {}
