-- AlterEnum
ALTER TYPE "question_type" ADD VALUE 'open';

-- AlterTable
ALTER TABLE "attempt" ALTER COLUMN "option_order" DROP DEFAULT;

-- AlterTable
ALTER TABLE "attempt_answer" ADD COLUMN     "ai_feedback" TEXT,
ADD COLUMN     "ai_score" DECIMAL(5,2),
ADD COLUMN     "answer_text" TEXT;

-- AlterTable
ALTER TABLE "question" ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "reference_answer" TEXT;
