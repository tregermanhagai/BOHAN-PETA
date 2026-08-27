import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { UpdateQuizGradingRequest } from "@bohan-peta/shared-types";

export class UpdateQuizGradingDto implements UpdateQuizGradingRequest {
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(60)
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passScore?: number;

  @IsOptional()
  @IsString()
  passFeedbackText?: string | null;

  @IsOptional()
  @IsString()
  failFeedbackText?: string | null;

  @IsOptional()
  @IsBoolean()
  sendResultEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  revealAnswerKey?: boolean;
}
