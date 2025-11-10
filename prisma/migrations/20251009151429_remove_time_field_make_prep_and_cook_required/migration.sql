-- AlterTable
-- Make preparationTime and cookingTime required (NOT NULL)
ALTER TABLE "Recipe" ALTER COLUMN "preparationTime" SET NOT NULL;
ALTER TABLE "Recipe" ALTER COLUMN "cookingTime" SET NOT NULL;

-- DropColumn
-- Remove the old time column
ALTER TABLE "Recipe" DROP COLUMN "time";

