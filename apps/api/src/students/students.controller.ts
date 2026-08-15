import { Body, Controller, Post } from "@nestjs/common";
import { StudentsService } from "./students.service";
import { JoinAttemptDto } from "./dto/join-attempt.dto";

// Public — no auth. Every exam is reached through this one shared URL,
// distinguished only by the access token in the body (PRD 3.1, v2.5).
@Controller("assignments")
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Post("join")
  join(@Body() dto: JoinAttemptDto) {
    return this.students.join(dto);
  }
}
