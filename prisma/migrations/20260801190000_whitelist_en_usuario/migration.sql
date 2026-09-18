-- La whitelist deja de deducirse de las solicitudes en cada carga.
--
-- Se preguntaba en el foro, en el perfil y al repartir insignias, siempre con la
-- misma consulta contra Submission. Ahora es una marca en el usuario: sigue
-- poniéndose al aceptar la solicitud, pero además puede llegar de Discord, donde
-- el staff a veces la da a mano.

ALTER TABLE "User" ADD COLUMN "whitelisted" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User" SET "whitelisted" = true WHERE "id" IN (
    SELECT "userId" FROM "Submission"
    WHERE "type" = 'whitelist' AND "status" = 'ACCEPTED'
);
