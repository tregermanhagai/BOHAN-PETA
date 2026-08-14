import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? "dev-only-insecure-secret",
    });
  }

  async validate(payload: JwtPayload) {
    const teacher = await this.prisma.teacher.findUnique({ where: { id: payload.sub } });
    if (!teacher) {
      throw new UnauthorizedException();
    }
    // Attached to req.user by Passport; consumed via @CurrentTeacher().
    return { id: teacher.id, email: teacher.email, name: teacher.name };
  }
}
