import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MinLength, Min } from "class-validator";
import type { GenerateQuestionsQuestionType, GenerateQuestionsRequest, QuizDifficulty } from "@bohan-peta/shared-types";

export class GenerateQuestionsDto implements GenerateQuestionsRequest {
  // Optional here — AiGenerationService requires topic OR an attached
  // file, a cross-field rule class-validator can't express cleanly given
  // the file arrives outside the JSON/form body. Enforced in the service.
  @IsOptional()
  @IsString()
  @MinLength(3)
  topic?: string;

  // Same bounds as manual authoring (F-11). @Type coerces the string
  // values multipart/form-data always sends into numbers before
  // validation — a no-op when the body arrives as JSON instead.
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(20)
  questionCount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(6)
  optionsPerQuestion!: number;

  @IsIn(["single", "multi", "mixed"])
  questionType!: GenerateQuestionsQuestionType;

  @IsOptional()
  @IsIn(["easy", "medium", "hard"])
  difficulty?: QuizDifficulty | null;

  @IsOptional()
  @IsString()
  language?: string;
}
