-- AlterTable
-- Default applies only to existing rows at migration time (Postgres
-- back-fills them with '{}'); the app always supplies a real value on
-- every new insert, so nothing downstream relies on the default itself.
ALTER TABLE "attempt" ADD COLUMN     "option_order" JSONB NOT NULL DEFAULT '{}';
