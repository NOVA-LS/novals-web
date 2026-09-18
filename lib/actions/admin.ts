"use server";

import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { traerForm } from "@/lib/forms/registro";
import { ETIQUETA } from "@/lib/consultas";
import { sincronizarInsignias } from "@/lib/insignias/sincronizar";
import { ACCIONES, apuntar } from "@/lib/auditoria";
import { empujarADiscord, traerDeDiscordATodos } from "@/lib/discord/sincronizar";
import { EQUIPOS } from "@/lib/equipos";
import type { Role, StaffTag } from "@/generated/prisma/enums";

export async function cambiarEstadoFormulario(tipo: string, abierto: boolean) {
  const admin = await requireUser("ADMIN");

  const form = await traerForm(tipo);
  if (!form) throw new Error("FORMULARIO_DESCONOCIDO");

  await db.formConfig.upsert({
    where: { type: tipo },
    update: { open: abierto },
    create: { type: tipo, open: abierto },
  });

  await apuntar({
    accion: ACCIONES.FORMULARIO,
    actor: admin,
    objetivo: form.title,
    url: "/panel/formularios",
    detalle: abierto ? "abierta" : "cerrada",
  });

  // La portada dice cuáles están abiertos, y eso viene de la caché.
  updateTag(ETIQUETA.formularios);
  revalidatePath("/");
  revalidatePath("/formularios");
  revalidatePath(`/formularios/${tipo}`);
  revalidatePath("/panel/formularios");
  revalidatePath(`/panel/formularios/${tipo}`);
}

export async function cambiarCooldown(tipo: string, dias: number) {
  await requireUser("ADMIN");
  if (!(await traerForm(tipo))) throw new Error("FORMULARIO_DESCONOCIDO");

  const valor = Math.max(0, Math.min(365, Math.trunc(dias)));

  await db.formConfig.upsert({
    where: { type: tipo },
    update: { cooldownDays: valor },
    create: { type: tipo, cooldownDays: valor },
  });

  revalidatePath("/panel/formularios");
  revalidatePath(`/panel/formularios/${tipo}`);
}

/**
 * Guarda la ventana de apertura programada. Una fecha vacía en el formulario
 * llega como cadena vacía, no como `undefined`; se guarda como `null`.
 */
export async function cambiarVentana(
  tipo: string,
  datos: { desde: string; hasta: string },
) {
  await requireUser("ADMIN");
  if (!(await traerForm(tipo))) throw new Error("FORMULARIO_DESCONOCIDO");

  const desde = datos.desde ? new Date(datos.desde) : null;
  const hasta = datos.hasta ? new Date(datos.hasta) : null;

  await db.formConfig.upsert({
    where: { type: tipo },
    update: { openFrom: desde, openUntil: hasta },
    create: { type: tipo, openFrom: desde, openUntil: hasta },
  });

  revalidatePath("/panel/formularios");
  revalidatePath(`/panel/formularios/${tipo}`);
  revalidatePath("/");
  revalidatePath("/formularios");
}

export async function cambiarRol(userId: string, rol: Role) {
  const admin = await requireUser("ADMIN");

  // Un admin no puede degradarse a sí mismo: evita quedarse sin ningún admin.
  if (admin.id === userId && rol !== "ADMIN") {
    throw new Error("NO_PUEDES_QUITARTE_ADMIN");
  }

  const antes = await db.user.findUnique({
    where: { id: userId },
    select: { username: true, role: true },
  });

  await db.user.update({ where: { id: userId }, data: { role: rol } });

  await apuntar({
    accion: ACCIONES.ROL,
    actor: admin,
    objetivo: antes?.username ?? userId,
    url: `/u/${userId}`,
    detalle: `${antes?.role ?? "?"} → ${rol}`,
  });

  // Entrar en el staff da insignia; salir no la quita, porque estuvo.
  await sincronizarInsignias(userId);
  // Y el rol de Discord se mueve con él: si no, habría que hacerlo dos veces.
  await empujarADiscord(userId);

  revalidatePath("/panel/usuarios");
}

/**
 * Repasa a todo el mundo contra Discord.
 *
 * Es la vuelta manual de la sincronización: lo normal es que los cambios de
 * Discord entren solos al iniciar sesión o por el aviso del bot, pero después de
 * una tanda de ascensos allí conviene poder traerlo todo de golpe.
 */
export async function traerRolesDeDiscord() {
  await requireUser("ADMIN");

  const cambiados = await traerDeDiscordATodos();

  revalidatePath("/panel/usuarios");
  return cambiados;
}

/**
 * Fija los equipos de alguien, todos de una vez.
 *
 * Va aparte de `cambiarRol` porque no es lo mismo: el rol abre puertas y esto
 * solo cuenta a qué se dedica. Se reescribe la lista entera en vez de calcular
 * altas y bajas: son cuatro filas por persona y así no hay estados a medias.
 */
export async function cambiarEquipos(userId: string, equipos: StaffTag[]) {
  const admin = await requireUser("ADMIN");

  const validos = EQUIPOS.filter((equipo) => equipos.includes(equipo));

  const antes = await db.user.findUnique({
    where: { id: userId },
    select: { username: true, teams: { select: { tag: true } } },
  });

  await db.$transaction([
    db.userTeam.deleteMany({ where: { userId } }),
    db.userTeam.createMany({
      data: validos.map((tag) => ({ userId, tag })),
    }),
  ]);

  await empujarADiscord(userId);

  await apuntar({
    accion: ACCIONES.EQUIPOS,
    actor: admin,
    objetivo: antes?.username ?? userId,
    url: `/u/${userId}`,
    detalle: `${antes?.teams.map((fila) => fila.tag).join(", ") || "ninguno"} → ${
      validos.join(", ") || "ninguno"
    }`,
  });

  revalidatePath("/panel/usuarios");
  revalidatePath(`/u/${userId}`);
  revalidatePath("/perfil");
  revalidatePath("/foro");
}
