import { Module } from "@nestjs/common";
import { QuizTemplatesController } from "./quiz-templates.controller";
import { QuizTemplatesService } from "./quiz-templates.service";

@Module({
  controllers: [QuizTemplatesController],
  providers: [QuizTemplatesService],
  exports: [QuizTemplatesService],
})
export class QuizTemplatesModule {}
