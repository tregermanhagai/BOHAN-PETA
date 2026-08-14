-- CreateEnum
CREATE TYPE "quiz_status" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "quiz_difficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "quiz_source_type" AS ENUM ('url', 'file');

-- CreateEnum
CREATE TYPE "question_type" AS ENUM ('single', 'multi');

-- CreateEnum
CREATE TYPE "attempt_ended_reason" AS ENUM ('submitted', 'focus_loss', 'time_expired');

-- CreateTable
CREATE TABLE "teacher" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_template" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "difficulty" "quiz_difficulty",
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "status" "quiz_status" NOT NULL DEFAULT 'draft',
    "teacher_notes" TEXT,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "pass_score" DECIMAL(5,2) NOT NULL DEFAULT 60,
    "pass_feedback_text" TEXT,
    "fail_feedback_text" TEXT,
    "reveal_answer_key" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_source" (
    "id" TEXT NOT NULL,
    "quiz_template_id" TEXT NOT NULL,
    "source_type" "quiz_source_type" NOT NULL,
    "url" TEXT,
    "storage_key" TEXT,

    CONSTRAINT "quiz_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question" (
    "id" TEXT NOT NULL,
    "quiz_template_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "question_type" NOT NULL,
    "source_reference" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "teacher_notes" TEXT,
    "image_url" TEXT,
    "image_prompt" TEXT,
    "sort_order" INTEGER,

    CONSTRAINT "question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_option" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "answer_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_assignment" (
    "id" TEXT NOT NULL,
    "quiz_template_id" TEXT NOT NULL,
    "cohort_id" TEXT NOT NULL,
    "access_code" TEXT NOT NULL,
    "open_at" TIMESTAMP(3),
    "close_at" TIMESTAMP(3),
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "shuffle" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "quiz_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "national_id" TEXT NOT NULL,
    "email" TEXT,

    CONSTRAINT "student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt" (
    "id" TEXT NOT NULL,
    "quiz_assignment_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "score" DECIMAL(5,2),
    "ended_reason" "attempt_ended_reason",
    "question_order" TEXT[],

    CONSTRAINT "attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_answer" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "selected_option_ids" TEXT[],

    CONSTRAINT "attempt_answer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_email_key" ON "teacher"("email");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_assignment_access_code_key" ON "quiz_assignment"("access_code");

-- CreateIndex
CREATE UNIQUE INDEX "student_national_id_key" ON "student"("national_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_quiz_assignment_id_student_id_key" ON "attempt"("quiz_assignment_id", "student_id");

-- AddForeignKey
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_template" ADD CONSTRAINT "quiz_template_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_source" ADD CONSTRAINT "quiz_source_quiz_template_id_fkey" FOREIGN KEY ("quiz_template_id") REFERENCES "quiz_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question" ADD CONSTRAINT "question_quiz_template_id_fkey" FOREIGN KEY ("quiz_template_id") REFERENCES "quiz_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_option" ADD CONSTRAINT "answer_option_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_assignment" ADD CONSTRAINT "quiz_assignment_quiz_template_id_fkey" FOREIGN KEY ("quiz_template_id") REFERENCES "quiz_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_assignment" ADD CONSTRAINT "quiz_assignment_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_quiz_assignment_id_fkey" FOREIGN KEY ("quiz_assignment_id") REFERENCES "quiz_assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answer" ADD CONSTRAINT "attempt_answer_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answer" ADD CONSTRAINT "attempt_answer_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
