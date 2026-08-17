import { BadRequestException, Body, Controller, Param, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentTeacher, CurrentTeacherPayload } from "../auth/current-teacher.decorator";
import { AiGenerationService } from "./ai-generation.service";
import { GenerateQuestionsDto } from "./dto/generate-questions.dto";

const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIMETYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

@UseGuards(JwtAuthGuard)
@Controller("quiz-templates")
export class AiGenerationController {
  constructor(private readonly aiGeneration: AiGenerationService) {}

  @Post(":id/generate")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: undefined, // memory storage (default) — never touches disk; the file is only needed for this one request
      limits: { fileSize: MAX_SOURCE_FILE_BYTES },
    }),
  )
  generate(
    @CurrentTeacher() teacher: CurrentTeacherPayload,
    @Param("id") id: string,
    @Body() dto: GenerateQuestionsDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file && !ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException("Source file must be a PDF or DOCX document");
    }
    return this.aiGeneration.generate(teacher.id, id, dto, file);
  }
}
