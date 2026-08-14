import { IsBoolean, IsISO8601, IsOptional, IsString, MinLength } from "class-validator";
import type { UpdateCohortRequest } from "@bohan-peta/shared-types";

export class UpdateCohortDto implements UpdateCohortRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string | null;

  @IsOptional()
  @IsISO8601()
  endDate?: string | null;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
