import { Module } from "@nestjs/common";
import { GeminiService } from "./gemini.service";

// Split out from AiGenerationModule so other features (e.g. AttemptsModule
// grading open-question answers) can use GeminiService without pulling in
// question-generation's controller/service too.
@Module({
  providers: [GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}
