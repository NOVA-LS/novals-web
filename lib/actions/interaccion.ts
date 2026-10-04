"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/guards";
import { puedeVotar } from "@/lib/encuesta";
import { consumir } from "@/lib/rate-limit";

type ResultadoInteraccion = { ok: boolean; mensaje?: string };

const UNA_HORA = 60 * 60 * 1000;

async function usuarioActual(): Promise<SessionUser | null> {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

/**
 * Vota, cambia el voto o lo retira (`optionId` nulo). Todo se comprueba aquí,
 * no en la interfaz: una pestaña abierta de antes puede estar votando en una
 * encuesta que ya se cerró.
 */
export async function votarEncuesta(
  pollId: string,
  optionId: string | null,
): Promise<ResultadoInteraccion> {
  const usuario = await usuarioActual();
  if (!usuario) return { ok: false, mensaje: "Necesitas iniciar sesión con Discord." };

  const limite = consumir(`voto:${usuario.id}`, 30, UNA_HORA);
  if (!limite.permitido) {
    return { ok: false, mensaje: "Demasiados cambios seguidos. Espera un poco." };
  }

  const encuesta = await db.postPoll.findUnique({
    where: { id: pollId },
    select: {
      closesAt: true,
      post: { select: { published: true, slug: true } },
      options: { select: { id: true } },
    },
  });
  if (!encuesta) return { ok: false, mensaje: "Esa encuesta ya no existe." };

  const permiso = puedeVotar(encuesta.post, encuesta);
  if (!permiso.ok) return permiso;

  if (optionId === null) {
    await db.pollVote.deleteMany({ where: { pollId, userId: usuario.id } });
  } else {
    // Una opción de otra encuesta no vale aunque exista.
    if (!encuesta.options.some((opcion) => opcion.id === optionId)) {
      return { ok: false, mensaje: "Esa opción no existe." };
    }

    await db.pollVote.upsert({
      where: { pollId_userId: { pollId, userId: usuario.id } },
      create: { pollId, optionId, userId: usuario.id },
      update: { optionId },
    });
  }

  revalidatePath(`/noticias/${encuesta.post.slug}`);
  return { ok: true };
}

/** Pone o quita el apoyo de quien pulsa. */
export async function alternarApoyo(postId: string): Promise<ResultadoInteraccion> {
  const usuario = await usuarioActual();
  if (!usuario) return { ok: false, mensaje: "Necesitas iniciar sesión con Discord." };

  const limite = consumir(`apoyo:${usuario.id}`, 60, UNA_HORA);
  if (!limite.permitido) {
    return { ok: false, mensaje: "Demasiados cambios seguidos. Espera un poco." };
  }

  const noticia = await db.post.findFirst({
    where: { id: postId, published: true },
    select: { slug: true },
  });
  if (!noticia) return { ok: false, mensaje: "Esa noticia no está disponible." };

  const quitados = await db.postSupport.deleteMany({ where: { postId, userId: usuario.id } });
  if (quitados.count === 0) {
    try {
      await db.postSupport.create({ data: { postId, userId: usuario.id } });
    } catch {
      // Dos clics a la vez: el otro ya lo creó. El resultado es el mismo.
    }
  }

  revalidatePath(`/noticias/${noticia.slug}`);
  return { ok: true };
}
