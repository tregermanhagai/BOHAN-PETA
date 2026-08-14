import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsIn,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import type { AnswerOptionInput, UpsertQuestionRequest } from "@bohan-peta/shared-types";

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

  @IsIn(["single", "multi"])
  type!: "single" | "multi";

  // 2-6 answer options per question (F-11).
  @ValidateNested({ each: true })
  @Type(() => AnswerOptionInputDto)
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  options!: AnswerOptionInputDto[];
}
