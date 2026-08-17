import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenAI, type PartUnion } from "@google/genai";
import mammoth from "mammoth";
import type { GenerateQuestionsQuestionType, QuizDifficulty } from "@bohan-peta/shared-types";

export interface DraftOption {
  text: string;
  isCorrect: boolean;
}

export interface DraftQuestion {
  text: string;
  type: "single" | "multi";
  options: DraftOption[];
}

export interface SourceFile {
  mimetype: string;
  buffer: Buffer;
}

export interface GenerateQuestionsParams {
  /** Optional when sourceFile is present — the file becomes the subject matter (F-10). */
  topic?: string;
  questionCount: number;
  optionsPerQuestion: number;
  questionType: GenerateQuestionsQuestionType;
  difficulty: QuizDifficulty | null;
  language: string;
  sourceFile?: SourceFile;
}

const DEFAULT_MODEL = "gemini-3.6-flash";
const DOCX_MIMETYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
// Keeps prompt size (and cost) bounded — plenty for a source chapter/article;
// Gemini reads PDFs natively so this cap only applies to DOCX text extraction.
const MAX_EXTRACTED_TEXT_CHARS = 60_000;

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenAI | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("GEMINI_API_KEY");
    this.model = this.config.get<string>("GEMINI_MODEL") ?? DEFAULT_MODEL;
    if (!apiKey) {
      this.logger.warn("GEMINI_API_KEY not set — AI question generation will be unavailable.");
      this.client = null;
      return;
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateQuestions(params: GenerateQuestionsParams): Promise<DraftQuestion[]> {
    if (!this.client) {
      throw new ServiceUnavailableException("AI generation is not configured");
    }

    const typeEnum: Array<"single" | "multi"> =
      params.questionType === "mixed" ? ["single", "multi"] : [params.questionType];

    const schema = {
      type: "array",
      minItems: params.questionCount,
      maxItems: params.questionCount,
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          type: { type: "string", enum: typeEnum },
          options: {
            type: "array",
            minItems: params.optionsPerQuestion,
            maxItems: params.optionsPerQuestion,
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                isCorrect: { type: "boolean" },
              },
              required: ["text", "isCorrect"],
            },
          },
        },
        required: ["text", "type", "options"],
      },
    };

    const contents = await this.buildContents(params);

    let raw: string;
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
        },
      });
      raw = response.text ?? "";
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Gemini request failed: ${message}`);
      // Gemini's own overload signal — distinct from our own failures, and
      // worth telling the teacher apart from "something's wrong with your
      // request": this one just means try again in a moment.
      if (message.includes('"status":"UNAVAILABLE"') || message.includes('"code":503')) {
        throw new ServiceUnavailableException("The AI service is currently busy — please try again in a moment");
      }
      throw new ServiceUnavailableException("AI generation request failed — please try again");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ServiceUnavailableException("AI generation returned an unreadable response — please try again");
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new BadRequestException("AI generation did not return any questions — try a different topic");
    }

    return parsed as DraftQuestion[];
  }

  /**
   * PDFs are passed to Gemini as native inline file data — it reads them
   * multimodally, no text extraction needed. DOCX isn't a format Gemini
   * ingests directly, so its text is extracted server-side (mammoth) and
   * included as plain prompt context instead.
   */
  private async buildContents(params: GenerateQuestionsParams): Promise<PartUnion[]> {
    const instructions = [
      `Generate exactly ${params.questionCount} multiple-choice quiz questions` +
        (params.sourceFile ? " based on the attached source document." : ` about: ${params.topic}`),
      params.topic && params.sourceFile ? `Focus specifically on: ${params.topic}.` : null,
      `Difficulty level: ${params.difficulty ?? "medium"}.`,
      `Write the question text and answer options in this language: ${params.language}.`,
      `Each question must have exactly ${params.optionsPerQuestion} answer options.`,
      `For a "single" type question, exactly one option must have isCorrect: true.`,
      `For a "multi" type question, at least two options must have isCorrect: true (never just one).`,
      "Questions must be factually accurate and unambiguous — do not invent facts.",
      "Return only the JSON array described by the schema, nothing else.",
    ]
      .filter((line): line is string => Boolean(line))
      .join(" ");

    if (!params.sourceFile) {
      return [instructions];
    }

    if (params.sourceFile.mimetype === "application/pdf") {
      return [
        instructions,
        {
          inlineData: {
            mimeType: "application/pdf",
            data: params.sourceFile.buffer.toString("base64"),
          },
        },
      ];
    }

    if (params.sourceFile.mimetype === DOCX_MIMETYPE) {
      const { value: text } = await mammoth.extractRawText({ buffer: params.sourceFile.buffer });
      const truncated = text.length > MAX_EXTRACTED_TEXT_CHARS;
      const sourceText = text.slice(0, MAX_EXTRACTED_TEXT_CHARS);
      return [
        instructions,
        `Source document text:\n${sourceText}${truncated ? "\n[...truncated]" : ""}`,
      ];
    }

    // Controller already rejects other mimetypes before this is reached.
    throw new BadRequestException("Unsupported source file type");
  }
}
