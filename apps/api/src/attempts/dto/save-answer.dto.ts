import { IsArray, IsOptional, IsString } from "class-validator";
import type { SaveAnswerRequest } from "@bohan-peta/shared-types";

export class SaveAnswerDto implements SaveAnswerRequest {
  @IsArray()
  @IsString({ each: true })
  selectedOptionIds!: string[];

  @IsOptional()
  @IsString()
  answerText?: string;
}
