import { IsEmail, IsString } from "class-validator";
import type { LoginRequest } from "@bohan-peta/shared-types";

export class LoginDto implements LoginRequest {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
