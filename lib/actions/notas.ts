"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";

export type ResultadoNota = { ok: boolean; mensaje?: string };

const MAX_LARGO = 1000;

/**
 * Deja una nota interna sobre un jugador.
 *
 * Se guarda con autor y fecha en vez de pisar un campo único: cuando el staff
 * cambia, importa saber quién escribió qué y cuándo.
 */
export async function anadirNota(
  userId: string,
  texto: string,
): Promise<ResultadoNota> {
  const autor = await requireUser("INICIADOR");

  const cuerpo = texto.trim();
  if (cuerpo.length < 3) {
    return { ok: false, mensaje: "La nota está vacía." };
  }
  if (cuerpo.length > MAX_LARGO) {
    return { ok: false, mensaje: `Máximo ${MAX_LARGO} caracteres.` };
  }

  const existe = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!existe) return { ok: false, mensaje: "Ese usuario ya no existe." };

  await db.userNote.create({
    data: { userId, authorId: autor.id, body: cuerpo },
  });

  revalidatePath("/panel/solicitudes");
  revalidatePath("/panel/ajustes");
  return { ok: true };
}

/** Solo la borra quien la escribió, o un admin. */
export async function borrarNota(id: string): Promise<ResultadoNota> {
  const usuario = await requireUser("INICIADOR");

  const nota = await db.userNote.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (!nota) return { ok: true };

  if (nota.authorId !== usuario.id && usuario.role !== "ADMIN") {
    return { ok: false, mensaje: "Solo puedes borrar tus propias notas." };
  }

  await db.userNote.delete({ where: { id } });

  revalidatePath("/panel/solicitudes");
  revalidatePath("/panel/ajustes");
  return { ok: true };
}
