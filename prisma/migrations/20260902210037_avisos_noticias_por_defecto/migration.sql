-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "whitelisted" BOOLEAN NOT NULL DEFAULT false,
    "avisosNoticias" BOOLEAN NOT NULL DEFAULT true,
    "referredById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("avatar", "avisosNoticias", "createdAt", "discordId", "id", "referredById", "role", "username", "whitelisted") SELECT "avatar", "avisosNoticias", "createdAt", "discordId", "id", "referredById", "role", "username", "whitelisted" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Activa el aviso para quien ya tuviera cuenta antes de que existiera: nadie
-- ha tenido ocasión de elegir todavía, así que arrancan con el nuevo valor
-- por defecto en vez de quedarse en el false de cuando el campo no existía.
UPDATE "User" SET "avisosNoticias" = true;
