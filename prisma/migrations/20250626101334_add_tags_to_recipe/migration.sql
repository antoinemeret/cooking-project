-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recipe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "rawIngredients" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "startSeason" INTEGER NOT NULL,
    "endSeason" INTEGER NOT NULL,
    "grade" INTEGER NOT NULL DEFAULT 0,
    "time" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Recipe" ("createdAt", "endSeason", "grade", "id", "instructions", "rawIngredients", "startSeason", "summary", "time", "title", "updatedAt") SELECT "createdAt", "endSeason", "grade", "id", "instructions", "rawIngredients", "startSeason", "summary", "time", "title", "updatedAt" FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
