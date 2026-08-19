import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { throttleLimit } from "./common/throttle.util";
import { PrismaModule } from "./prisma/prisma.module";
import { MailModule } from "./mail/mail.module";
import { HealthController } from "./health/health.controller";
import { AuthModule } from "./auth/auth.module";
import { CohortsModule } from "./cohorts/cohorts.module";
import { StudentsModule } from "./students/students.module";
import { QuizTemplatesModule } from "./quiz-templates/quiz-templates.module";
import { QuizAssignmentsModule } from "./quiz-assignments/quiz-assignments.module";
import { AttemptsModule } from "./attempts/attempts.module";
import { ScoresModule } from "./scores/scores.module";
import { AiGenerationModule } from "./ai-generation/ai-generation.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global default (60 req/min/IP) — most routes never override this.
    // Auth and the public join endpoint set their own stricter/looser
    // limits via @Throttle (see auth.controller.ts, students.controller.ts).
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: throttleLimit(60) }]),
    PrismaModule,
    MailModule,
    AuthModule,
    CohortsModule,
    StudentsModule,
    QuizTemplatesModule,
    QuizAssignmentsModule,
    AttemptsModule,
    ScoresModule,
    AiGenerationModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
