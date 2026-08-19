import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { throttleLimit } from "../common/throttle.util";
import { AuthService } from "./auth.service";
import { RegisterTeacherDto } from "./dto/register-teacher.dto";
import { LoginDto } from "./dto/login.dto";

// Stricter than the app-wide default — classic brute-force targets, and
// legitimate usage here is just the one teacher, so there's no reason to
// allow the same volume as public/high-traffic routes.
const AUTH_THROTTLE = { default: { limit: throttleLimit(10), ttl: 60_000 } };

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Throttle(AUTH_THROTTLE)
  register(@Body() dto: RegisterTeacherDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
