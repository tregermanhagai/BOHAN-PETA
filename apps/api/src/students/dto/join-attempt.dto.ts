import { IsEmail, IsString, MinLength } from "class-validator";
import type { JoinAttemptRequest } from "@bohan-peta/shared-types";

export class JoinAttemptDto implements JoinAttemptRequest {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsString()
  @MinLength(1)
  nationalId!: string;

  // Required (not optional) — the result email (score + review link) is
  // the only place a student can find their review link after the exam.
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  accessCode!: string;
}
