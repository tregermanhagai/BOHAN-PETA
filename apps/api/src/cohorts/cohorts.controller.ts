import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentTeacher, CurrentTeacherPayload } from "../auth/current-teacher.decorator";
import { CohortsService } from "./cohorts.service";
import { CreateCohortDto } from "./dto/create-cohort.dto";
import { UpdateCohortDto } from "./dto/update-cohort.dto";

@UseGuards(JwtAuthGuard)
@Controller("cohorts")
export class CohortsController {
  constructor(private readonly cohortsService: CohortsService) {}

  @Post()
  create(@CurrentTeacher() teacher: CurrentTeacherPayload, @Body() dto: CreateCohortDto) {
    return this.cohortsService.create(teacher.id, dto);
  }

  @Get()
  findAll(@CurrentTeacher() teacher: CurrentTeacherPayload) {
    return this.cohortsService.findAllForTeacher(teacher.id);
  }

  @Get(":id")
  findOne(@CurrentTeacher() teacher: CurrentTeacherPayload, @Param("id") id: string) {
    return this.cohortsService.findOneForTeacher(teacher.id, id);
  }

  @Patch(":id")
  update(
    @CurrentTeacher() teacher: CurrentTeacherPayload,
    @Param("id") id: string,
    @Body() dto: UpdateCohortDto,
  ) {
    return this.cohortsService.update(teacher.id, id, dto);
  }
}
