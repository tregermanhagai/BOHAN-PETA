import { BadRequestException, Injectable } from "@nestjs/common";
import type { QuestionResponse } from "@bohan-peta/shared-types";
import { QuizTemplatesService } from "../quiz-templates/quiz-templates.service";
import { GeminiService } from "./gemini.service";
import { GenerateQuestionsDto } from "./dto/generate-questions.dto";

@Injectable()
export class AiGenerationService {
  constructor(
    private readonly quizTemplates: QuizTemplatesService,
    private readonly gemini: GeminiService,
  ) {}

  /**
   * Generated questions are inserted as normal (draft) Question rows via
   * the same addQuestion path manual authoring uses — so the quiz's
   * existing draft/publish lifecycle IS the "mandatory teacher review
   * before publishing" step F-12 requires, with no separate review
   * screen or draft-question concept needed.
   *
   * The source file (F-10), if any, is used only for this one request —
   * it's never written to disk or persisted, so there's nothing to clean
   * up and no object storage dependency.
   */
  async generate(
    teacherId: string,
    quizTemplateId: string,
    dto: GenerateQuestionsDto,
    file?: Express.Multer.File,
  ): Promise<QuestionResponse[]> {
    if (!dto.topic && !file) {
      throw new BadRequestException("Provide a topic, a source file, or both");
    }

    const quiz = await this.quizTemplates.findOneForTeacher(teacherId, quizTemplateId);

    const drafts = await this.gemini.generateQuestions({
      topic: dto.topic,
      questionCount: dto.questionCount,
      optionsPerQuestion: dto.optionsPerQuestion,
      questionType: dto.questionType,
      difficulty: dto.difficulty ?? quiz.difficulty,
      language: dto.language ?? quiz.language,
      sourceFile: file ? { mimetype: file.mimetype, buffer: file.buffer } : undefined,
    });

    const created: QuestionResponse[] = [];
    for (const draft of drafts) {
      created.push(
        await this.quizTemplates.addQuestion(teacherId, quizTemplateId, {
          text: draft.text,
          type: draft.type,
          options: draft.options,
        }),
      );
    }

    await this.quizTemplates.markAiGenerated(teacherId, quizTemplateId);
    return created;
  }
}
