import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentTeacher, CurrentTeacherPayload } from "../auth/current-teacher.decorator";
import { QuizTemplatesService } from "./quiz-templates.service";
import { CreateQuizTemplateDto } from "./dto/create-quiz-template.dto";
import { UpdateQuizTemplateDto } from "./dto/update-quiz-template.dto";
import { UpdateQuizGradingDto } from "./dto/update-quiz-grading.dto";
import { UpdateQuizStatusDto } from "./dto/update-quiz-status.dto";
import { UpsertQuestionDto } from "./dto/upsert-question.dto";

@UseGuards(JwtAuthGuard)
@Controller("quiz-templates")
export class QuizTemplatesController {
  constructor(private readonly quizTemplates: QuizTemplatesService) {}

  @Post()
  create(@CurrentTeacher() teacher: CurrentTeacherPayload, @Body() dto: CreateQuizTemplateDto) {
    return this.quizTemplates.create(teacher.id, dto);
  }

  @Get()
  findAll(@CurrentTeacher() teacher: CurrentTeacherPayload) {
    return this.quizTemplates.findAllForTeacher(teacher.id);
  }

  @Get(":id")
  findOne(@CurrentTeacher() teacher: CurrentTeacherPayload, @Param("id") id: string) {
    return this.quizTemplates.findOneForTeacher(teacher.id, id);
  }

  @Patch(":id")
  update(
    @CurrentTeacher() teacher: CurrentTeacherPayload,
    @Param("id") id: string,
    @Body() dto: UpdateQuizTemplateDto,
  ) {
    return this.quizTemplates.update(teacher.id, id, dto);
  }

  @Patch(":id/grading")
  updateGrading(
    @CurrentTeacher() teacher: CurrentTeacherPayload,
    @Param("id") id: string,
    @Body() dto: UpdateQuizGradingDto,
  ) {
    return this.quizTemplates.updateGrading(teacher.id, id, dto);
  }

  @Patch(":id/status")
  updateStatus(
    @CurrentTeacher() teacher: CurrentTeacherPayload,
    @Param("id") id: string,
    @Body() dto: UpdateQuizStatusDto,
  ) {
    return this.quizTemplates.updateStatus(teacher.id, id, dto);
  }

  @Post(":id/questions")
  addQuestion(
    @CurrentTeacher() teacher: CurrentTeacherPayload,
    @Param("id") id: string,
    @Body() dto: UpsertQuestionDto,
  ) {
    return this.quizTemplates.addQuestion(teacher.id, id, dto);
  }

  @Patch(":id/questions/:qid")
  updateQuestion(
    @CurrentTeacher() teacher: CurrentTeacherPayload,
    @Param("id") id: string,
    @Param("qid") qid: string,
    @Body() dto: UpsertQuestionDto,
  ) {
    return this.quizTemplates.updateQuestion(teacher.id, id, qid, dto);
  }

  @Delete(":id/questions/:qid")
  deleteQuestion(
    @CurrentTeacher() teacher: CurrentTeacherPayload,
    @Param("id") id: string,
    @Param("qid") qid: string,
  ) {
    return this.quizTemplates.deleteQuestion(teacher.id, id, qid);
  }
}
