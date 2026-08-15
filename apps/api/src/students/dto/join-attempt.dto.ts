import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";
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

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsString()
  @MinLength(1)
  accessCode!: string;
}
