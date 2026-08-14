import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthResponse } from "@bohan-peta/shared-types";
import { RegisterTeacherDto } from "./dto/register-teacher.dto";
import { LoginDto } from "./dto/login.dto";

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterTeacherDto): Promise<AuthResponse> {
    const existing = await this.prisma.teacher.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const teacher = await this.prisma.teacher.create({
      data: { name: dto.name, email: dto.email, passwordHash },
    });

    return this.buildAuthResponse(teacher.id, teacher.email, teacher.name, teacher.createdAt);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const teacher = await this.prisma.teacher.findUnique({ where: { email: dto.email } });
    if (!teacher) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const passwordOk = await bcrypt.compare(dto.password, teacher.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.buildAuthResponse(teacher.id, teacher.email, teacher.name, teacher.createdAt);
  }

  private buildAuthResponse(id: string, email: string, name: string, createdAt: Date): AuthResponse {
    const accessToken = this.jwt.sign({ sub: id, email });
    return {
      accessToken,
      teacher: { id, email, name, createdAt: createdAt.toISOString() },
    };
  }
}
