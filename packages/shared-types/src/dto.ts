/**
 * Request/response payload shapes for the API surface (PRD section 9.3).
 * attempts and ai-generation DTOs get added as those modules are built.
 */
import type {
  AnswerOption,
  Cohort,
  Question,
  QuizAssignment,
  QuizDifficulty,
  QuizTemplate,
  QuestionType,
  Teacher,
} from "./entities";

export interface RegisterTeacherRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  teacher: Teacher;
}

export interface CreateCohortRequest {
  name: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateCohortRequest {
  name?: string;
  startDate?: string | null;
  endDate?: string | null;
  archived?: boolean;
}

export type CohortResponse = Cohort;

// ---------------------------------------------------------------
// Quiz templates (F-13/F-14, PRD 3.4)
// ---------------------------------------------------------------

export interface CreateQuizTemplateRequest {
  title: string;
  language?: string;
  difficulty?: QuizDifficulty | null;
}

export interface UpdateQuizTemplateRequest {
  title?: string;
  language?: string;
  difficulty?: QuizDifficulty | null;
}

/** PATCH /quiz-templates/:id/grading — F-04/F-27/F-28. */
export interface UpdateQuizGradingRequest {
  durationMinutes?: number;
  passScore?: number;
  passFeedbackText?: string | null;
  failFeedbackText?: string | null;
  revealAnswerKey?: boolean;
}

export interface UpdateQuizStatusRequest {
  status: "draft" | "published";
}

export type QuizTemplateResponse = QuizTemplate & { questions: QuestionResponse[] };
export type QuizTemplateSummaryResponse = QuizTemplate & { questionCount: number };

// ---------------------------------------------------------------
// Questions (F-11/F-13/F-14)
// ---------------------------------------------------------------

export interface AnswerOptionInput {
  text: string;
  isCorrect: boolean;
}

export interface UpsertQuestionRequest {
  text: string;
  type: QuestionType;
  options: AnswerOptionInput[];
}

export type QuestionResponse = Question & { options: AnswerOption[] };

// ---------------------------------------------------------------
// Quiz assignments (F-21/F-22, PRD 3.3)
// ---------------------------------------------------------------

export interface CreateQuizAssignmentRequest {
  quizTemplateId: string;
  openAt?: string | null;
  closeAt?: string | null;
  maxAttempts?: number;
  shuffle?: boolean;
}

export type QuizAssignmentResponse = QuizAssignment & { quizTemplateTitle: string };
