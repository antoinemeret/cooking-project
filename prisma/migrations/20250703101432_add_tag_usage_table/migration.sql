-- CreateTable
CREATE TABLE "TagUsage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "lastUsed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TagUsage_userId_tag_key" ON "TagUsage"("userId", "tag");
