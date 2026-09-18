import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

// Uso:
//   pnpm seed <discordId>          -> marca ese usuario como ADMIN
//
// Los formularios ya no se siembran: se montan desde el panel, en
// /panel/formularios, y viven en la base.
async function main() {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  const discordId = process.argv[2];
  if (discordId) {
    const user = await db.user.upsert({
      where: { discordId },
      update: { role: "ADMIN" },
      create: { discordId, username: "admin", role: "ADMIN" },
    });
    console.log(`Usuario ${user.username} (${discordId}) es ADMIN`);
  } else {
    console.log(
      "Sin discordId: no se ha creado ningún admin. Pásalo como argumento para crearlo.",
    );
  }

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
