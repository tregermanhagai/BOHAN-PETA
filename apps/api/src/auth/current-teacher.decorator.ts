import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface CurrentTeacherPayload {
  id: string;
  email: string;
  name: string;
}

export const CurrentTeacher = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentTeacherPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
