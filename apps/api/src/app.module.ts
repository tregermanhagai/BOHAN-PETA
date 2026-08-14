import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthController } from "./health/health.controller";
import { AuthModule } from "./auth/auth.module";
import { CohortsModule } from "./cohorts/cohorts.module";
import { StudentsModule } from "./students/students.module";
import { QuizTemplatesModule } from "./quiz-templates/quiz-templates.module";
import { QuizAssignmentsModule } from "./quiz-assignments/quiz-assignments.module";
import { AttemptsModule } from "./attempts/attempts.module";
import { AiGenerationModule } from "./ai-generation/ai-generation.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CohortsModule,
    StudentsModule,
    QuizTemplatesModule,
    QuizAssignmentsModule,
    AttemptsModule,
    AiGenerationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
