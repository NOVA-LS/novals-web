"use server";

import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { borrarImagen, guardarImagen } from "@/lib/uploads";
import { ETIQUETA } from "@/lib/consultas";
import { ACCIONES, apuntar } from "@/lib/auditoria";
import {
  MAX_FOTO_MB,
  MAX_IMAGENES_POR_TANDA as MAX_POR_TANDA,
} from "@/lib/limites";

export type ResultadoGaleria = { ok: boolean; mensaje?: string };

export async function subirFotos(datos: FormData): Promise<ResultadoGaleria> {
  const autor = await requireUser("ADMIN");

  const archivos = datos
    .getAll("fotos")
    .filter((valor): valor is File => valor instanceof File && valor.size > 0);

  if (archivos.length === 0) {
    return { ok: false, mensaje: "Elige al menos una imagen." };
  }
  if (archivos.length > MAX_POR_TANDA) {
    return { ok: false, mensaje: `Sube como mucho ${MAX_POR_TANDA} de una vez.` };
  }

  const pie = String(datos.get("caption") ?? "").trim();

  // Las nuevas van al final; el staff las sube o baja después si quiere.
  const ultima = await db.photo.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });
  let posicion = (ultima?.position ?? 0) + 1;

  for (const archivo of archivos) {
    let imagen;
    try {
      imagen = await guardarImagen(archivo, "La foto", MAX_FOTO_MB);
    } catch (error) {
      // Las anteriores ya están guardadas: cortamos y decimos en cuál falló.
      return { ok: false, mensaje: (error as Error).message };
    }

    await db.photo.create({
      data: {
        ...imagen,
        // Un pie común para toda la tanda solo tiene sentido si sube una sola.
        caption: archivos.length === 1 && pie ? pie : null,
        position: posicion++,
        authorId: autor.id,
      },
    });
  }

  updateTag(ETIQUETA.galeria);
  revalidatePath("/");
  revalidatePath("/panel/galeria");
  return { ok: true };
}

export async function borrarFoto(id: string) {
  const autor = await requireUser("ADMIN");

  const foto = await db.photo.delete({
    where: { id },
    select: { url: true, caption: true },
  });
  await borrarImagen(foto.url);

  await apuntar({
    accion: ACCIONES.CONTENIDO,
    actor: autor,
    objetivo: `Foto ${foto.caption ? `«${foto.caption}»` : foto.url}`,
    url: "/panel/galeria",
    detalle: "borrada",
  });

  updateTag(ETIQUETA.galeria);
  revalidatePath("/");
  revalidatePath("/panel/galeria");
}

export async function editarPie(id: string, caption: string) {
  await requireUser("ADMIN");

  await db.photo.update({
    where: { id },
    data: { caption: caption.trim() || null },
  });

  updateTag(ETIQUETA.galeria);
  revalidatePath("/");
  revalidatePath("/panel/galeria");
}

/**
 * Intercambia la posición con la foto vecina. Se hace por intercambio y no
 * recalculando todas para que dos revisores a la vez no se pisen el orden entero.
 */
export async function moverFoto(id: string, direccion: "arriba" | "abajo") {
  await requireUser("ADMIN");

  const foto = await db.photo.findUnique({
    where: { id },
    select: { id: true, position: true },
  });
  if (!foto) return;

  const vecina = await db.photo.findFirst({
    where:
      direccion === "arriba"
        ? { position: { lt: foto.position } }
        : { position: { gt: foto.position } },
    orderBy: { position: direccion === "arriba" ? "desc" : "asc" },
    select: { id: true, position: true },
  });
  if (!vecina) return;

  await db.$transaction([
    db.photo.update({ where: { id: foto.id }, data: { position: vecina.position } }),
    db.photo.update({ where: { id: vecina.id }, data: { position: foto.position } }),
  ]);

  updateTag(ETIQUETA.galeria);
  revalidatePath("/");
  revalidatePath("/panel/galeria");
}
