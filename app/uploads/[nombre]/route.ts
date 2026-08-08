import path from "node:path";
import { readFile } from "node:fs/promises";
import { rutaDeSubida, TIPO_POR_EXTENSION } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * Sirve las imágenes que sube el staff.
 *
 * Viven en `public/uploads`, pero eso no basta: el servidor de producción de
 * Next reparte los ficheros de `public` que existían al compilar, así que una
 * foto subida después se quedaba en disco y el navegador recibía un 404. En
 * `next dev` sí se servía, que es por lo que no se veía en local.
 *
 * Qué nombres se admiten lo decide `rutaDeSubida`, que es lo único que hay entre
 * el texto que llega por la URL y una lectura de disco.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ nombre: string }> },
) {
  const { nombre } = await params;
  const ruta = rutaDeSubida(nombre);
  if (!ruta) return new Response(null, { status: 404 });

  try {
    const datos = await readFile(ruta);
    return new Response(new Uint8Array(datos), {
      headers: {
        "Content-Type":
          TIPO_POR_EXTENSION[path.extname(nombre).toLowerCase()] ?? "application/octet-stream",
        // El nombre lo pone la web y no se repite nunca: al cambiar una foto
        // cambia también su dirección, así que no hay nada que revalidar.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    // Borrada del disco pero aún en la base, o un nombre inventado.
    return new Response(null, { status: 404 });
  }
}
