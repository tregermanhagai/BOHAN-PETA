/**
 * Request/response payload shapes for the API surface (PRD section 9.3).
 * attempts and ai-generation DTOs get added as those modules are built.
 */
import type {
  AnswerOption,
  AttemptEndedReason,
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
  /** Ignored/empty for "open" questions. */
  options: AnswerOptionInput[];
  /** Required for "open" questions — the model answer the AI grades against. */
  referenceAnswer?: string;
  /** "open" questions only; teacher-set point value (default 5 client-side). Forced to 1 server-side for single/multi. */
  points?: number;
}

export type QuestionResponse = Question & { options: AnswerOption[] };

// ---------------------------------------------------------------
// AI-assisted generation (F-10–F-12, PRD section 6)
// ---------------------------------------------------------------

/**
 * "mixed" lets Gemini choose single vs. multi per question; the other two
 * force every generated question to that type. Deliberately NOT derived
 * from the general QuestionType (which also includes "open") — AI
 * generation only ever produces single/multi questions; open questions
 * are authored by hand with a teacher-written reference answer, AI's role
 * there is grading a student's answer, not generating the question.
 */
export type GenerateQuestionsQuestionType = "single" | "multi" | "mixed";

export interface GenerateQuestionsRequest {
  /**
   * What the questions should be about, e.g. "QA role in Scrum team".
   * Optional when a source file is attached (F-10) — the file becomes the
   * subject matter and topic becomes an optional focus/filter on top of it.
   * Required when no file is attached.
   */
  topic?: string;
  /** 3–20, matching the manual-authoring bounds (F-11). */
  questionCount: number;
  /** 2–6, matching the manual-authoring bounds (F-11). */
  optionsPerQuestion: number;
  questionType: GenerateQuestionsQuestionType;
  /** Defaults to the quiz template's own difficulty/language if omitted. */
  difficulty?: QuizDifficulty | null;
  language?: string;
}

/** Newly created questions, in the same shape as manual authoring — added as normal (draft) Question rows for the teacher to review/edit before publishing (F-12). */
export type GenerateQuestionsResponse = QuestionResponse[];

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

// ---------------------------------------------------------------
// Student join & attempts (F-01–F-08a, PRD 3.1/3.7/3.8, v2.5)
// ---------------------------------------------------------------

export interface JoinAttemptRequest {
  firstName: string;
  lastName: string;
  /** Format-validated server-side (F-02); default Israeli ID checksum. */
  nationalId: string;
  /** Required — the score/review-link email is sent here after submission. */
  email: string;
  accessCode: string;
}

export interface JoinAttemptResponse {
  attemptId: string;
  quizTitle: string;
  durationMinutes: number;
  questionCount: number;
}

/** Client-safe — never carries which option is correct (3.1 exam-taking view). */
export interface AttemptOptionView {
  id: string;
  text: string;
}

export interface AttemptQuestionView {
  id: string;
  text: string;
  type: QuestionType;
  options: AttemptOptionView[];
  /** Already-saved answer, if any — powers resume (F-05). */
  selectedOptionIds: string[];
  /** Already-saved free-text answer, if any (open questions only) — powers resume. */
  answerText: string | null;
  points: number;
}

export interface AttemptQuestionsResponse {
  questions: AttemptQuestionView[];
  startedAt: string;
  durationMinutes: number;
  /** Non-null if the server has already closed this attempt (e.g. time
   *  expired since the last request) — client should show the result
   *  screen instead of continuing the exam. */
  endedReason: AttemptEndedReason | null;
}

export interface SaveAnswerRequest {
  selectedOptionIds: string[];
  /** Open questions only. */
  answerText?: string;
}

export interface AttemptResultResponse {
  score: number;
  passed: boolean;
  feedbackText: string;
  endedReason: AttemptEndedReason;
  /** The Attempt UUID itself — the bearer token for the review link (3.1). */
  reviewToken: string;
}

export interface AttemptReviewOption {
  id: string;
  text: string;
  /** Present only when the quiz's reveal_answer_key is on (F-07b). */
  isCorrect?: boolean;
}

export interface AttemptReviewQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options: AttemptReviewOption[];
  selectedOptionIds: string[];
  /** Open questions only. */
  answerText: string | null;
  points: number;
  /** Points actually earned — equals `points` or 0 for single/multi (binary), 0..points for open (AI-graded). */
  pointsEarned: number;
  /** Only present when the quiz's reveal_answer_key is on (open questions only, F-07b-equivalent). */
  aiFeedback?: string | null;
  correct: boolean;
}

export interface AttemptReviewResponse {
  score: number;
  passed: boolean;
  feedbackText: string;
  endedReason: AttemptEndedReason;
  revealAnswerKey: boolean;
  questions: AttemptReviewQuestion[];
}

// ---------------------------------------------------------------
// Cohort scores (F-23/F-24, PRD 3.3/5.3)
// ---------------------------------------------------------------

/** Distinct from AttemptEndedReason only by adding "in_progress" — an attempt with no ended reason yet. */
export type AttemptStatus = "in_progress" | AttemptEndedReason;

export interface ScoreRow {
  attemptId: string;
  studentId: string;
  studentName: string;
  nationalId: string;
  quizAssignmentId: string;
  quizTemplateId: string;
  quizTitle: string;
  status: AttemptStatus;
  score: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
  timeTakenSeconds: number | null;
}

export type CohortScoresResponse = ScoreRow[];
