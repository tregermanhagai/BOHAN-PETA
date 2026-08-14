import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { UpdateQuizTemplateRequest } from "@bohan-peta/shared-types";

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export class UpdateQuizTemplateDto implements UpdateQuizTemplateRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsIn(DIFFICULTIES)
  difficulty?: "easy" | "medium" | "hard" | null;
}
