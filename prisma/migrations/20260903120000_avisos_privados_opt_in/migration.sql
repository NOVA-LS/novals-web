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
    "avisosNoticias" BOOLEAN NOT NULL DEFAULT false,
    "avisosNoticiasPreguntado" BOOLEAN NOT NULL DEFAULT false,
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

-- Quien ya tenía cuenta antes de este cambio no está entrando por primera
-- vez: se le da por preguntado con lo que ya tuviera elegido, y no le sale
-- el aviso de bienvenida.
UPDATE "User" SET "avisosNoticiasPreguntado" = true;
