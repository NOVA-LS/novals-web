-- El staff pasa de dos escalones (REVIEWER, ADMIN) a cuatro
-- (INICIADOR, SOPORTE, MODERADOR, ADMIN).
--
-- En SQLite un enum de Prisma es texto, así que no hay estructura que cambiar:
-- lo que hay que mover son los datos. Quien era REVIEWER pasa a INICIADOR, que
-- es el escalón que hereda su trabajo (whitelist e historias). Sin esto, esas
-- filas se quedarían con un valor que el cliente ya no reconoce.
UPDATE "User" SET "role" = 'INICIADOR' WHERE "role" = 'REVIEWER';
