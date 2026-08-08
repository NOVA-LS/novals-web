-- Las insignias dejan de repartirse a mano.
--
-- El catálogo (nombre, icono y, sobre todo, la condición para ganarlas) pasa a
-- vivir en lib/insignias/catalogo.ts, porque una condición es código. En la base
-- solo queda quién tiene cuál y desde cuándo, referida por su clave de texto.
--
-- Lo repartido antes a mano no se conserva: aquellas insignias no tenían
-- condición, así que no hay forma de saber si sus dueños se las habrían ganado.
-- Al desplegar hay que pulsar «Repasar a todos» en el panel, que recalcula.

PRAGMA foreign_keys=OFF;

-- CreateTable
CREATE TABLE "new_UserBadge" (
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "slug"),
    CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

DROP TABLE "UserBadge";
ALTER TABLE "new_UserBadge" RENAME TO "UserBadge";

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- DropTable
DROP TABLE "Badge";

PRAGMA foreign_keys=ON;
