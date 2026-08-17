import { Module } from "@nestjs/common";
import { QuizTemplatesModule } from "../quiz-templates/quiz-templates.module";
import { AiGenerationController } from "./ai-generation.controller";
import { AiGenerationService } from "./ai-generation.service";
import { GeminiService } from "./gemini.service";

@Module({
  imports: [QuizTemplatesModule],
  controllers: [AiGenerationController],
  providers: [AiGenerationService, GeminiService],
})
export class AiGenerationModule {}
