-- Los equipos pasan de uno a varios.
--
-- En Discord una misma persona lleva Programador y Gestión de eventos a la vez,
-- así que guardar un único distintivo obligaba a elegir cuál se pierde. Ahora es
-- una fila por equipo, y el conjunto se sincroniza con los roles del servidor.

PRAGMA foreign_keys=OFF;

-- CreateTable
CREATE TABLE "UserTeam" (
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    PRIMARY KEY ("userId", "tag"),
    CONSTRAINT "UserTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserTeam_userId_idx" ON "UserTeam"("userId");

-- Lo que había en la columna se conserva como su primera fila.
INSERT INTO "UserTeam" ("userId", "tag")
SELECT "id", "staffTag" FROM "User" WHERE "staffTag" IS NOT NULL;

-- Y la columna desaparece.
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_User" ("id", "discordId", "username", "avatar", "role", "createdAt")
SELECT "id", "discordId", "username", "avatar", "role", "createdAt" FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";

CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

PRAGMA foreign_keys=ON;
