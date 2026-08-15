-- DropIndex
DROP INDEX "attempt_quiz_assignment_id_student_id_key";

-- CreateIndex
CREATE INDEX "attempt_quiz_assignment_id_student_id_idx" ON "attempt"("quiz_assignment_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_answer_attempt_id_question_id_key" ON "attempt_answer"("attempt_id", "question_id");

