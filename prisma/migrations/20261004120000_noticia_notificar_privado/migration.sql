-- AlterTable
-- Las noticias que ya había avisaban por privado siempre: se queda como estaba.
ALTER TABLE "Post" ADD COLUMN "notificarPrivado" BOOLEAN NOT NULL DEFAULT true;
