import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type OutputInfo } from "sharp";
import { MAX_IMAGEN_MB, MAX_LADO_PX, MAX_PDF_MB } from "@/lib/limites";

/**
 * Guardado de imágenes en disco.
 *
 * Vive en `public/uploads`, que en Docker es un volumen: las imágenes
 * sobreviven a los despliegues sin depender de ningún servicio externo.
 *
 * Nada se guarda tal cual llega: todo se reescala y se reescribe en WEBP. Aparte
 * del disco que ahorra, eso deja fuera los metadatos EXIF del original, que en
 * una captura de móvil pueden llevar la posición de quien la hizo.
 */

const DIRECTORIO = path.join(process.cwd(), "public", "uploads");
const TIPOS = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Un nombre de fichero nuestro: letra o número, luego lo que sea de un puñado de
 * signos, y una extensión de imagen. Ni barras, ni puntos al principio, ni dos
 * extensiones seguidas.
 */
const NOMBRE = /^[a-zA-Z0-9][a-zA-Z0-9_-]*\.(webp|jpe?g|png|pdf)$/;

/** Qué se manda en Content-Type según cómo acabe el nombre. */
export const TIPO_POR_EXTENSION: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
};

/**
 * Dónde está en disco un fichero subido, o `null` si ese nombre no es de los
 * nuestros.
 *
 * Hace falta porque lo que sube la gente no lo sirve Next: el servidor de
 * producción reparte los ficheros de `public` que existían al compilar, y una
 * foto subida después se queda en disco dando 404. La sirve una ruta nuestra
 * (`app/uploads/[nombre]/route.ts`), y esto es lo único que separa un nombre
 * llegado por la URL de una lectura de disco.
 */
export function rutaDeSubida(nombre: string): string | null {
  if (!NOMBRE.test(nombre)) return null;

  // El patrón ya deja fuera las barras y los puntos, pero el que de verdad
  // decide qué se abre es esto: si al quedarnos con el último tramo cambia algo,
  // es que el nombre llevaba ruta dentro.
  if (path.basename(nombre) !== nombre) return null;

  return path.join(DIRECTORIO, nombre);
}

export type ImagenGuardada = {
  url: string;
  width: number;
  height: number;
};

/**
 * Valida y escribe una imagen subida. Lanza con un mensaje que se le puede
 * enseñar a quien la sube.
 *
 * El peso máximo se pasa por parámetro porque no todas las imágenes valen lo
 * mismo: una portada de noticia se ve pequeña y una foto de galería ocupa la
 * pantalla entera.
 */
export async function guardarImagen(
  archivo: File,
  etiqueta = "La imagen",
  maxMb = MAX_IMAGEN_MB,
): Promise<ImagenGuardada> {
  if (!TIPOS.has(archivo.type)) {
    throw new Error(`${etiqueta} debe ser JPG, PNG o WEBP.`);
  }
  if (archivo.size > maxMb * 1024 * 1024) {
    throw new Error(`${etiqueta} supera los ${maxMb} MB.`);
  }

  const bytes = Buffer.from(await archivo.arrayBuffer());

  let salida: { data: Buffer; info: OutputInfo };
  try {
    salida = await sharp(bytes)
      // La orientación de EXIF se aplica ahora, porque al reescribir el fichero
      // ese dato se pierde y la foto quedaría tumbada.
      .rotate()
      .resize({
        width: MAX_LADO_PX,
        height: MAX_LADO_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new Error(`${etiqueta} no parece una imagen válida.`);
  }

  await mkdir(DIRECTORIO, { recursive: true });
  const nombre = `${randomUUID()}.webp`;
  await writeFile(path.join(DIRECTORIO, nombre), salida.data);

  // Las medidas son las del fichero ya guardado, no las del original: con ellas
  // next/image reserva el hueco y la página no da saltos al cargar.
  return {
    url: `/uploads/${nombre}`,
    width: salida.info.width,
    height: salida.info.height,
  };
}

/** Los PDF empiezan siempre por esta cabecera; cualquier otra cosa no lo es. */
const CABECERA_PDF = Buffer.from("%PDF-");

/**
 * Valida y escribe un PDF subido. Lanza con un mensaje que se le puede
 * enseñar a quien lo sube.
 *
 * A diferencia de `guardarImagen`, el fichero se escribe tal cual: un PDF no
 * se reescala ni se reescribe, así que no hay nada que `sharp` pueda hacer
 * con él. Por eso hace falta mirar la cabecera de verdad: el `Content-Type`
 * lo declara el navegador de quien sube, y nada impide subir cualquier
 * binario diciendo que es un PDF para que se sirva como tal desde `/uploads`.
 */
export async function guardarDocumento(
  archivo: File,
  etiqueta = "El archivo",
  maxMb = MAX_PDF_MB,
): Promise<{ url: string }> {
  if (archivo.type !== "application/pdf") {
    throw new Error(`${etiqueta} debe ser un PDF.`);
  }
  if (archivo.size > maxMb * 1024 * 1024) {
    throw new Error(`${etiqueta} supera los ${maxMb} MB.`);
  }

  const bytes = Buffer.from(await archivo.arrayBuffer());

  if (!bytes.subarray(0, CABECERA_PDF.length).equals(CABECERA_PDF)) {
    throw new Error(`${etiqueta} no es un PDF de verdad.`);
  }

  await mkdir(DIRECTORIO, { recursive: true });
  const nombre = `${randomUUID()}.pdf`;
  await writeFile(path.join(DIRECTORIO, nombre), bytes);

  return { url: `/uploads/${nombre}` };
}

/**
 * Borra del disco una imagen subida. No lanza: si el archivo ya no está, el
 * registro de la base de datos se borra igual.
 */
export async function borrarImagen(url: string) {
  if (!url.startsWith("/uploads/")) return;

  try {
    await unlink(path.join(DIRECTORIO, path.basename(url)));
  } catch (error) {
    console.error(`No se pudo borrar ${url}`, error);
  }
}
