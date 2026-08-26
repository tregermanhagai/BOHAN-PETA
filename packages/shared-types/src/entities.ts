/**
 * Core domain shapes mirrored from PRD section 5 (Data Model), v2.5.
 * These describe API payload shapes, not the DB rows directly (the API
 * layer owns Prisma-generated row types internally).
 */

export type QuizDifficulty = "easy" | "medium" | "hard";
export type QuizStatus = "draft" | "published";
export type QuestionType = "single" | "multi" | "open";
export type QuizSourceType = "url" | "file";
export type AttemptEndedReason = "submitted" | "focus_loss" | "time_expired";

export interface Teacher {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Cohort {
  id: string;
  teacherId: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  /** F-20: cohorts are archived, not deleted, to preserve historical scores. */
  archived: boolean;
}

export interface QuizTemplate {
  id: string;
  teacherId: string;
  title: string;
  language: string;
  difficulty: QuizDifficulty | null;
  aiGenerated: boolean;
  status: QuizStatus;
  teacherNotes: string | null;
  durationMinutes: number;
  passScore: number;
  passFeedbackText: string | null;
  failFeedbackText: string | null;
  revealAnswerKey: boolean;
  createdAt: string;
}

export interface QuizSource {
  id: string;
  quizTemplateId: string;
  sourceType: QuizSourceType;
  url: string | null;
  storageKey: string | null;
}

export interface Question {
  id: string;
  quizTemplateId: string;
  text: string;
  type: QuestionType;
  sourceReference: string | null;
  isActive: boolean;
  teacherNotes: string | null;
  imageUrl: string | null;
  imagePrompt: string | null;
  sortOrder: number | null;
  /** Always 1 for single/multi (not editable); teacher-set for "open" (default 5). */
  points: number;
  /** Only populated for "open" questions — the model answer the AI grades against. */
  referenceAnswer: string | null;
  options: AnswerOption[];
}

export interface AnswerOption {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizAssignment {
  id: string;
  quizTemplateId: string;
  cohortId: string;
  accessCode: string;
  openAt: string | null;
  closeAt: string | null;
  maxAttempts: number;
  shuffle: boolean;
}

export interface Attempt {
  id: string;
  quizAssignmentId: string;
  studentId: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  endedReason: AttemptEndedReason | null;
  /** v2.5 / F-04d: shuffled question order, captured once at attempt start. */
  questionOrder: string[];
}

export interface AttemptAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  selectedOptionIds: string[];
  answerText: string | null;
  aiScore: number | null;
  aiFeedback: string | null;
}
