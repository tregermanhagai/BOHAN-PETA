import { IsBoolean, IsISO8601, IsInt, IsOptional, IsString, Min } from "class-validator";
import type { CreateQuizAssignmentRequest } from "@bohan-peta/shared-types";

export class CreateQuizAssignmentDto implements CreateQuizAssignmentRequest {
  @IsString()
  quizTemplateId!: string;

  @IsOptional()
  @IsISO8601()
  openAt?: string | null;

  @IsOptional()
  @IsISO8601()
  closeAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @IsOptional()
  @IsBoolean()
  shuffle?: boolean;
}
