import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { throttleLimit } from "../common/throttle.util";
import { StudentsService } from "./students.service";
import { JoinAttemptDto } from "./dto/join-attempt.dto";

// Public — no auth. Every exam is reached through this one shared URL,
// distinguished only by the access token in the body (PRD 3.1, v2.5).
@Controller("assignments")
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Post("join")
  // Deliberately looser than the app-wide default despite being public
  // and PII-bearing (v2.5 NFR): a whole classroom on shared Wi-Fi can
  // share one public IP, and ~10-20 students joining within the same
  // minute right when a teacher reveals the access code is the expected
  // legitimate pattern, not abuse. Too strict here locks out real students.
  @Throttle({ default: { limit: throttleLimit(30), ttl: 60_000 } })
  join(@Body() dto: JoinAttemptDto) {
    return this.students.join(dto);
  }
}
