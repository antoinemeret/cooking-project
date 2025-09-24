-- CreateTable
CREATE TABLE "Recipe" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "rawIngredients" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "startSeason" INTEGER NOT NULL,
    "endSeason" INTEGER NOT NULL,
    "grade" INTEGER NOT NULL DEFAULT 0,
    "time" INTEGER NOT NULL,
    "preparationTime" INTEGER,
    "cookingTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "image" TEXT,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startSeason" INTEGER NOT NULL,
    "endSeason" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedRecipe" (
    "id" SERIAL NOT NULL,
    "mealPlanId" INTEGER NOT NULL,
    "recipeId" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannedRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryList" (
    "id" SERIAL NOT NULL,
    "mealPlanId" INTEGER NOT NULL,
    "ingredients" TEXT NOT NULL,
    "checkedItems" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonResult" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ollamaResult" TEXT NOT NULL,
    "traditionalResult" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComparisonResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonEvaluation" (
    "id" SERIAL NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "titleScore" INTEGER,
    "ingredientsScore" INTEGER,
    "instructionsScore" INTEGER,
    "totalScore" INTEGER,
    "titleAccurate" BOOLEAN,
    "ingredientsAccurate" BOOLEAN,
    "instructionsAccurate" BOOLEAN,
    "overallSuccess" BOOLEAN,
    "evaluatorNotes" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComparisonEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceMetrics" (
    "id" SERIAL NOT NULL,
    "technologyName" TEXT NOT NULL,
    "totalTests" INTEGER NOT NULL DEFAULT 0,
    "successfulParses" INTEGER NOT NULL DEFAULT 0,
    "failedParses" INTEGER NOT NULL DEFAULT 0,
    "averageProcessingTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "titleAccuracyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ingredientsAccuracyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "instructionsAccuracyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallAccuracyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fastestParse" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "slowestParse" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "medianProcessingTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagUsage" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RecipeIngredients" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_RecipeIngredients_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GroceryList_mealPlanId_key" ON "GroceryList"("mealPlanId");

-- CreateIndex
CREATE INDEX "ComparisonResult_status_idx" ON "ComparisonResult"("status");

-- CreateIndex
CREATE INDEX "ComparisonResult_timestamp_idx" ON "ComparisonResult"("timestamp");

-- CreateIndex
CREATE INDEX "ComparisonResult_url_idx" ON "ComparisonResult"("url");

-- CreateIndex
CREATE INDEX "ComparisonEvaluation_technology_idx" ON "ComparisonEvaluation"("technology");

-- CreateIndex
CREATE INDEX "ComparisonEvaluation_overallSuccess_idx" ON "ComparisonEvaluation"("overallSuccess");

-- CreateIndex
CREATE INDEX "ComparisonEvaluation_totalScore_idx" ON "ComparisonEvaluation"("totalScore");

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonEvaluation_comparisonId_technology_key" ON "ComparisonEvaluation"("comparisonId", "technology");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceMetrics_technologyName_key" ON "PerformanceMetrics"("technologyName");

-- CreateIndex
CREATE UNIQUE INDEX "TagUsage_userId_tag_key" ON "TagUsage"("userId", "tag");

-- CreateIndex
CREATE INDEX "_RecipeIngredients_B_index" ON "_RecipeIngredients"("B");

-- AddForeignKey
ALTER TABLE "PlannedRecipe" ADD CONSTRAINT "PlannedRecipe_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedRecipe" ADD CONSTRAINT "PlannedRecipe_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryList" ADD CONSTRAINT "GroceryList_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonEvaluation" ADD CONSTRAINT "ComparisonEvaluation_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "ComparisonResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RecipeIngredients" ADD CONSTRAINT "_RecipeIngredients_A_fkey" FOREIGN KEY ("A") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RecipeIngredients" ADD CONSTRAINT "_RecipeIngredients_B_fkey" FOREIGN KEY ("B") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
