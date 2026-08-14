import { IsIn } from "class-validator";
import type { UpdateQuizStatusRequest } from "@bohan-peta/shared-types";

export class UpdateQuizStatusDto implements UpdateQuizStatusRequest {
  @IsIn(["draft", "published"])
  status!: "draft" | "published";
}
