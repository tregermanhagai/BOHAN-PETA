import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import type { AttemptGradingOverrideItem, UpdateAttemptGradingRequest } from "@bohan-peta/shared-types";

export class AttemptGradingOverrideItemDto implements AttemptGradingOverrideItem {
  @IsString()
  @MinLength(1)
  questionId!: string;

  // null clears the override and reverts to the derived/AI value.
  @ValidateIf((o) => o.points !== null)
  @IsNumber()
  @Min(0)
  points!: number | null;
}

export class UpdateAttemptGradingDto implements UpdateAttemptGradingRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttemptGradingOverrideItemDto)
  overrides!: AttemptGradingOverrideItemDto[];

  @IsOptional()
  @IsBoolean()
  notifyStudent?: boolean;
}
