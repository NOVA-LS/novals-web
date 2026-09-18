"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { actorActual } from "@/lib/foro/actor";
import { getCategoria } from "@/lib/foro/categorias";
import {
  puedeBorrar,
  puedeEditar,
  puedeModerar,
  puedePublicar,
  puedeResponder,
} from "@/lib/foro/reglas";
import { consumir } from "@/lib/rate-limit";
import { crearAviso } from "@/lib/avisos";
import { CANAL, emitir } from "@/lib/eventos";
import { ACCIONES, apuntar, type Accion } from "@/lib/auditoria";
import { sincronizarInsignias } from "@/lib/insignias/sincronizar";
import { conSlugLibre } from "@/lib/foro/slug";

export type ResultadoForo = { ok: boolean; mensaje?: string };

const esquemaHilo = z.object({
  category: z.string().min(1),
  title: z.string().trim().min(6, "El título es demasiado corto.").max(120),
  body: z.string().trim().min(20, "Cuenta algo más.").max(20000),
});

const esquemaMensaje = z
  .string()
  .trim()
  .min(2, "El mensaje está vacío.")
  .max(20000, "El mensaje es larguísimo.");

/**
 * Apunta algo en el registro sabiendo solo el identificador de quien lo hizo.
 *
 * El actor del foro no trae nombre —a las reglas les basta con el rol— y el
 * registro se lee por nombre, así que aquí se busca.
 */
async function apuntarComoStaff(
  actorId: string,
  registro: { accion: Accion; objetivo: string; url?: string; detalle?: string },
) {
  const usuario = await db.user.findUnique({
    where: { id: actorId },
    select: { id: true, username: true },
  });

  await apuntar({ ...registro, actor: usuario });
}

export async function crearHilo(datos: FormData): Promise<ResultadoForo> {
  const actor = await actorActual();

  if (!puedePublicar(actor)) {
    return {
      ok: false,
      mensaje: "Para escribir en el foro necesitas la whitelist aceptada.",
    };
  }

  const limite = consumir(`hilo:${actor!.id}`, 5, 60 * 60 * 1000);
  if (!limite.permitido) {
    return { ok: false, mensaje: "Llevas muchos hilos seguidos. Espera un rato." };
  }

  const parsed = esquemaHilo.safeParse({
    category: datos.get("category"),
    title: datos.get("title"),
    body: datos.get("body"),
  });

  if (!parsed.success) {
    return { ok: false, mensaje: parsed.error.issues[0].message };
  }
  if (!getCategoria(parsed.data.category)) {
    return { ok: false, mensaje: "Esa categoría no existe." };
  }

  const hilo = await conSlugLibre(
    parsed.data.title,
    "hilo",
    async (slug) => !(await db.thread.findUnique({ where: { slug }, select: { id: true } })),
    (slug) =>
      db.thread.create({
        data: { ...parsed.data, slug, authorId: actor!.id },
        select: { slug: true, category: true },
      }),
  );

  // Antes del redirect: después de saltar ya no se ejecuta nada de aquí.
  await sincronizarInsignias(actor!.id);

  revalidatePath("/foro");
  revalidatePath(`/foro/${hilo.category}`);
  emitir(CANAL.foro());
  redirect(`/foro/${hilo.category}/${hilo.slug}`);
}

export async function responder(
  threadId: string,
  texto: string,
): Promise<ResultadoForo> {
  const actor = await actorActual();

  const hilo = await db.thread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      slug: true,
      title: true,
      category: true,
      locked: true,
      authorId: true,
    },
  });
  if (!hilo) return { ok: false, mensaje: "Ese hilo ya no existe." };

  if (!puedeResponder(actor, hilo)) {
    return {
      ok: false,
      mensaje: hilo.locked
        ? "Este hilo está cerrado."
        : "Para escribir en el foro necesitas la whitelist aceptada.",
    };
  }

  const limite = consumir(`respuesta:${actor!.id}`, 20, 60 * 60 * 1000);
  if (!limite.permitido) {
    return { ok: false, mensaje: "Vas muy rápido. Espera un poco." };
  }

  const parsed = esquemaMensaje.safeParse(texto);
  if (!parsed.success) {
    return { ok: false, mensaje: parsed.error.issues[0].message };
  }

  // La respuesta y la marca de actividad viajan juntas: si falla una, el hilo no
  // puede quedar ordenado por una respuesta que no existe.
  const [respuesta] = await db.$transaction([
    db.reply.create({
      data: { threadId: hilo.id, authorId: actor!.id, body: parsed.data },
      select: { id: true },
    }),
    db.thread.update({
      where: { id: hilo.id },
      data: { lastReplyAt: new Date() },
    }),
  ]);

  // A quien abrió el hilo se le avisa, salvo que se esté contestando a sí mismo.
  if (hilo.authorId !== actor!.id) {
    const quien = await db.user.findUnique({
      where: { id: actor!.id },
      select: { username: true },
    });

    await crearAviso({
      userId: hilo.authorId,
      tipo: "RESPUESTA",
      titulo: `${quien?.username ?? "Alguien"} respondió en «${hilo.title}»`,
      cuerpo: parsed.data,
      // Por la ruta del mensaje: es la que sabe en qué página del hilo cayó.
      url: `/foro/mensaje/${respuesta.id}`,
    });
  }

  await sincronizarInsignias(actor!.id);

  revalidatePath(`/foro/${hilo.category}/${hilo.slug}`);
  revalidatePath(`/foro/${hilo.category}`);
  revalidatePath("/foro");
  emitir(CANAL.foro());
  return { ok: true };
}

export async function editarRespuesta(
  id: string,
  texto: string,
): Promise<ResultadoForo> {
  const actor = await actorActual();

  const respuesta = await db.reply.findUnique({
    where: { id },
    select: {
      authorId: true,
      thread: { select: { slug: true, category: true } },
    },
  });
  if (!respuesta) return { ok: false, mensaje: "Ese mensaje ya no existe." };

  if (!puedeEditar(actor, respuesta)) {
    return { ok: false, mensaje: "Solo puedes editar tus propios mensajes." };
  }

  const parsed = esquemaMensaje.safeParse(texto);
  if (!parsed.success) return { ok: false, mensaje: parsed.error.issues[0].message };

  await db.reply.update({ where: { id }, data: { body: parsed.data } });

  revalidatePath(`/foro/${respuesta.thread.category}/${respuesta.thread.slug}`);
  return { ok: true };
}

export async function borrarRespuesta(id: string): Promise<ResultadoForo> {
  const actor = await actorActual();

  const respuesta = await db.reply.findUnique({
    where: { id },
    select: {
      authorId: true,
      thread: { select: { slug: true, category: true } },
    },
  });
  if (!respuesta) return { ok: true };

  if (!puedeBorrar(actor, respuesta)) {
    return { ok: false, mensaje: "No puedes borrar este mensaje." };
  }

  await db.reply.delete({ where: { id } });

  revalidatePath(`/foro/${respuesta.thread.category}/${respuesta.thread.slug}`);
  return { ok: true };
}

export async function borrarHilo(id: string): Promise<ResultadoForo> {
  const actor = await actorActual();

  const hilo = await db.thread.findUnique({
    where: { id },
    select: { authorId: true, category: true, title: true },
  });
  if (!hilo) return { ok: true };

  if (!puedeBorrar(actor, hilo)) {
    return { ok: false, mensaje: "No puedes borrar este hilo." };
  }

  // Las respuestas caen con él por la cascada del esquema.
  await db.thread.delete({ where: { id } });

  // Borrar el hilo de otro es de lo poco que no deja rastro por sí solo.
  if (actor && actor.id !== hilo.authorId) {
    await apuntarComoStaff(actor.id, {
      accion: ACCIONES.FORO,
      objetivo: `Hilo «${hilo.title}»`,
      detalle: "borrado",
    });
  }

  revalidatePath("/foro");
  revalidatePath(`/foro/${hilo.category}`);
  redirect(`/foro/${hilo.category}`);
}

/** Fijar y cerrar: dos interruptores del staff sobre un hilo. */
export async function moderarHilo(
  id: string,
  cambio: { pinned?: boolean; locked?: boolean },
): Promise<ResultadoForo> {
  const actor = await actorActual();
  if (!puedeModerar(actor)) {
    return { ok: false, mensaje: "Solo el staff modera el foro." };
  }

  const hilo = await db.thread.update({
    where: { id },
    data: cambio,
    select: { slug: true, category: true, title: true },
  });

  await apuntarComoStaff(actor!.id, {
    accion: ACCIONES.FORO,
    objetivo: `Hilo «${hilo.title}»`,
    url: `/foro/${hilo.category}/${hilo.slug}`,
    detalle: [
      cambio.pinned !== undefined ? (cambio.pinned ? "fijado" : "sin fijar") : null,
      cambio.locked !== undefined ? (cambio.locked ? "cerrado" : "reabierto") : null,
    ]
      .filter(Boolean)
      .join(" · "),
  });

  revalidatePath("/foro");
  revalidatePath(`/foro/${hilo.category}`);
  revalidatePath(`/foro/${hilo.category}/${hilo.slug}`);
  return { ok: true };
}
