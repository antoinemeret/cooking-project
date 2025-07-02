-- AlterTable
ALTER TABLE "ComparisonEvaluation" ADD COLUMN "ingredientsScore" INTEGER;
ALTER TABLE "ComparisonEvaluation" ADD COLUMN "instructionsScore" INTEGER;
ALTER TABLE "ComparisonEvaluation" ADD COLUMN "titleScore" INTEGER;
ALTER TABLE "ComparisonEvaluation" ADD COLUMN "totalScore" INTEGER;

-- CreateIndex
CREATE INDEX "ComparisonEvaluation_totalScore_idx" ON "ComparisonEvaluation"("totalScore");
