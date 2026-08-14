import { IsISO8601, IsOptional, IsString, MinLength } from "class-validator";
import type { CreateCohortRequest } from "@bohan-peta/shared-types";

export class CreateCohortDto implements CreateCohortRequest {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string | null;

  @IsOptional()
  @IsISO8601()
  endDate?: string | null;
}
