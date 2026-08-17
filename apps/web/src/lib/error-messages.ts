import type { TFunction } from "i18next";
import { ApiError } from "./api-client";

/**
 * Maps the backend's exact English exception text to an i18n key. The API
 * has no machine-readable error codes (every condition is only
 * distinguishable by its exact message string), so this list has to be
 * kept in sync by hand with apps/api/src — see each service's
 * `throw new ...Exception("...")` call sites.
 *
 * Deliberately NOT attempting to translate class-validator's own default
 * messages (e.g. "email must be an email") — those only reach a user if
 * they bypass the UI's own input constraints, and there are dozens of
 * decorator/field combinations across every DTO. Anything not in this
 * map — including all validation-pipe text — falls back to a single
 * generic translated message instead of raw English.
 */
const MESSAGE_KEYS: Record<string, string> = {
  "An account with this email already exists": "errors.emailAlreadyExists",
  "Invalid email or password": "errors.invalidCredentials",
  "endDate must not be before startDate": "errors.cohortDateRangeInvalid",
  "Cohort not found": "errors.cohortNotFound",
  "Invalid national ID": "errors.invalidNationalId",
  "Invalid exam token": "errors.invalidExamToken",
  "This exam is not open yet": "errors.examNotOpenYet",
  "This exam is closed": "errors.examClosed",
  "This exam is not currently available": "errors.examNotAvailable",
  "This exam has no questions": "errors.examNoQuestions",
  "You have already attempted this exam": "errors.alreadyAttempted",
  "At least one option must be marked correct": "errors.needCorrectOption",
  "A Single Choice question must have exactly one correct option": "errors.singleChoiceOneCorrect",
  "Quiz template not found": "errors.quizTemplateNotFound",
  "Quiz must be published before it can be assigned to a cohort": "errors.quizNotPublished",
  "Question not found": "errors.questionNotFound",
  "Assignment not found": "errors.assignmentNotFound",
  "This exam has already ended": "errors.examAlreadyEnded",
  "Question not part of this attempt": "errors.questionNotInAttempt",
  "This exam is still in progress": "errors.reviewInProgress",
  "Attempt not found": "errors.attemptNotFound",
  "AI generation is not configured": "errors.aiNotConfigured",
  "AI generation request failed — please try again": "errors.aiRequestFailed",
  "The AI service is currently busy — please try again in a moment": "errors.aiBusy",
  "AI generation returned an unreadable response — please try again": "errors.aiRequestFailed",
  "AI generation did not return any questions — try a different topic": "errors.aiNoQuestions",
  "Provide a topic, a source file, or both": "errors.aiNeedTopicOrFile",
  "Source file must be a PDF or DOCX document": "errors.aiUnsupportedFileType",
};

/** `"A quiz needs at least 3 questions to publish (has 1)"` — the one backend message with interpolated numbers. */
const PUBLISH_MIN_QUESTIONS = /^A quiz needs at least (\d+) questions to publish \(has (\d+)\)$/;

/**
 * Turns any caught error into a translated, user-safe string. Use this
 * everywhere an error is shown to the user instead of reading
 * `err.message` directly, so raw backend/network English text never
 * reaches the UI.
 */
export function translateApiError(err: unknown, t: TFunction): string {
  if (err instanceof ApiError) {
    const publishMatch = err.message.match(PUBLISH_MIN_QUESTIONS);
    if (publishMatch) {
      return t("errors.needMoreQuestionsToPublish", {
        min: Number(publishMatch[1]),
        count: Number(publishMatch[2]),
      });
    }
    const key = MESSAGE_KEYS[err.message];
    if (key) return t(key);
  }
  return t("errors.generic");
}
