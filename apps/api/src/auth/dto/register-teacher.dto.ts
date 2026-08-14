import { IsEmail, IsString, MinLength } from "class-validator";
import type { RegisterTeacherRequest } from "@bohan-peta/shared-types";

export class RegisterTeacherDto implements RegisterTeacherRequest {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  password!: string;
}
