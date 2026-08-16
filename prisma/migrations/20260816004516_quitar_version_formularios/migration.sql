/*
  Warnings:

  - You are about to drop the column `version` on the `FormConfig` table. All the data in the column will be lost.
  - You are about to drop the column `formVersion` on the `Submission` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FormConfig" (
    "type" TEXT NOT NULL PRIMARY KEY,
    "open" BOOLEAN NOT NULL DEFAULT true,
    "cooldownDays" INTEGER NOT NULL DEFAULT 7,
    "title" TEXT,
    "summary" TEXT,
    "fields" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "openFrom" DATETIME,
    "openUntil" DATETIME
);
INSERT INTO "new_FormConfig" ("cooldownDays", "fields", "open", "openFrom", "openUntil", "position", "summary", "title", "type") SELECT "cooldownDays", "fields", "open", "openFrom", "openUntil", "position", "summary", "title", "type" FROM "FormConfig";
DROP TABLE "FormConfig";
ALTER TABLE "new_FormConfig" RENAME TO "FormConfig";
CREATE TABLE "new_Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "staffNote" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Submission" ("answers", "createdAt", "id", "resolvedAt", "reviewerId", "staffNote", "status", "type", "userId") SELECT "answers", "createdAt", "id", "resolvedAt", "reviewerId", "staffNote", "status", "type", "userId" FROM "Submission";
DROP TABLE "Submission";
ALTER TABLE "new_Submission" RENAME TO "Submission";
CREATE INDEX "Submission_type_status_idx" ON "Submission"("type", "status");
CREATE INDEX "Submission_userId_type_createdAt_idx" ON "Submission"("userId", "type", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
