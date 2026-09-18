-- Al cerrar un ticket se le pide a su autor que puntúe la atención recibida.
-- Todo nulo: los tickets ya cerrados se quedan sin valorar, que es la verdad.
ALTER TABLE "Ticket" ADD COLUMN "valoracion" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN "valoracionNota" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "valoradoAt" DATETIME;
