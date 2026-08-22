import { Module } from "@nestjs/common";
import { GeminiModule } from "../ai-generation/gemini.module";
import { AttemptsController } from "./attempts.controller";
import { AttemptsService } from "./attempts.service";

@Module({
  imports: [GeminiModule],
  controllers: [AttemptsController],
  providers: [AttemptsService],
})
export class AttemptsModule {}
