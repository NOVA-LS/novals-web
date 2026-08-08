// scripts/generar-og-image.ts
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ANCHO = 1200;
const ALTO = 630;

async function main() {
  const origen = process.argv[2];

  if (!origen) {
    console.error("Uso: tsx scripts/generar-og-image.ts <ruta-imagen-origen>");
    process.exit(1);
  }

  if (!fs.existsSync(origen)) {
    console.error(`No existe: ${origen}`);
    process.exit(1);
  }

  const recorte = await sharp(origen)
    .resize(ANCHO, ALTO, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  const destinos = ["app/opengraph-image.png", "app/twitter-image.png"];

  for (const destino of destinos) {
    fs.writeFileSync(path.resolve(destino), recorte);
    console.log(`Escrito ${destino}`);
  }
}

main();
