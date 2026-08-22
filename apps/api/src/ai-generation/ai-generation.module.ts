import { Module } from "@nestjs/common";
import { QuizTemplatesModule } from "../quiz-templates/quiz-templates.module";
import { AiGenerationController } from "./ai-generation.controller";
import { AiGenerationService } from "./ai-generation.service";
import { GeminiModule } from "./gemini.module";

@Module({
  imports: [QuizTemplatesModule, GeminiModule],
  controllers: [AiGenerationController],
  providers: [AiGenerationService],
})
export class AiGenerationModule {}
