import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import type { AnswerOptionInput, QuestionType, UpsertQuestionRequest } from "@bohan-peta/shared-types";

export class AnswerOptionInputDto implements AnswerOptionInput {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class UpsertQuestionDto implements UpsertQuestionRequest {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsIn(["single", "multi", "open"])
  type!: QuestionType;

  // 2-6 answer options per question (F-11) — not applicable to "open"
  // questions, which carry a referenceAnswer instead (validated below).
  @ValidateIf((o) => o.type !== "open")
  @ValidateNested({ each: true })
  @Type(() => AnswerOptionInputDto)
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  options!: AnswerOptionInputDto[];

  @ValidateIf((o) => o.type === "open")
  @IsString()
  @MinLength(1)
  referenceAnswer?: string;

  @ValidateIf((o) => o.type === "open")
  @Type(() => Number)
  @IsInt()
  @Min(1)
  points?: number;
}
