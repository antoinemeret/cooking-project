-- CreateTable
CREATE TABLE "ComparisonResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ollamaResult" TEXT NOT NULL,
    "traditionalResult" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ComparisonEvaluation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "comparisonId" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "titleAccurate" BOOLEAN,
    "ingredientsAccurate" BOOLEAN,
    "instructionsAccurate" BOOLEAN,
    "overallSuccess" BOOLEAN,
    "evaluatorNotes" TEXT,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ComparisonEvaluation_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "ComparisonResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PerformanceMetrics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "technologyName" TEXT NOT NULL,
    "totalTests" INTEGER NOT NULL DEFAULT 0,
    "successfulParses" INTEGER NOT NULL DEFAULT 0,
    "failedParses" INTEGER NOT NULL DEFAULT 0,
    "averageProcessingTime" REAL NOT NULL DEFAULT 0,
    "successRate" REAL NOT NULL DEFAULT 0,
    "titleAccuracyRate" REAL NOT NULL DEFAULT 0,
    "ingredientsAccuracyRate" REAL NOT NULL DEFAULT 0,
    "instructionsAccuracyRate" REAL NOT NULL DEFAULT 0,
    "overallAccuracyRate" REAL NOT NULL DEFAULT 0,
    "fastestParse" REAL NOT NULL DEFAULT 0,
    "slowestParse" REAL NOT NULL DEFAULT 0,
    "medianProcessingTime" REAL NOT NULL DEFAULT 0,
    "lastUpdated" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
CREATE UNIQUE INDEX "ComparisonEvaluation_comparisonId_technology_key" ON "ComparisonEvaluation"("comparisonId", "technology");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceMetrics_technologyName_key" ON "PerformanceMetrics"("technologyName");
