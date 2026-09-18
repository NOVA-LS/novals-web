import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// El cliente se cachea en globalThis porque el hot reload de Next crea un
// módulo nuevo en cada recarga y abriría una conexión por cada una.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");

  const adapter = new PrismaBetterSqlite3({ url });
  const client = new PrismaClient({ adapter });

  // Sin WAL, cada escritura bloquea las lecturas (y al revés) más de lo que
  // hace falta: con el modo rollback-journal de por defecto, una consulta
  // larga y una escritura concurrente se pisan más de la cuenta. `busy_timeout`
  // hace que quien llega y encuentra la base ocupada espere en vez de fallar
  // al momento con SQLITE_BUSY. El adaptador no tiene una opción para esto en
  // el constructor: se manda como las dos primeras órdenes de la conexión.
  for (const pragma of ["PRAGMA journal_mode = WAL;", "PRAGMA busy_timeout = 5000;"]) {
    client.$executeRawUnsafe(pragma).catch((error: unknown) => {
      console.error(`No se pudo aplicar «${pragma}»`, error);
    });
  }

  return client;
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
