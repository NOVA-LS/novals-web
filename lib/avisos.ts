import "server-only";
import { db } from "@/lib/db";
import { desde, ESCALONES } from "@/lib/roles";
import { CANAL, emitir, emitirA } from "@/lib/eventos";
import type { Role } from "@/generated/prisma/enums";

/**
 * Avisos que se le enseñan a un usuario dentro de la web.
 *
 * Son el hermano de tierra de los privados de Discord (`lib/notifications`):
 * aquellos se pierden si tiene los mensajes directos cerrados, y estos no. Los
 * dos se mandan a la vez y ninguno depende del otro.
 */

export const TIPOS_AVISO = ["RESPUESTA", "SOLICITUD", "INSIGNIA", "TICKET"] as const;
export type TipoAviso = (typeof TIPOS_AVISO)[number];

/** Cuántos caben en el desplegable de la campana. */
export const EN_CAMPANA = 8;

/**
 * Largo del adelanto que se guarda como cuerpo.
 *
 * Se recorta al guardar y no al enseñar: un aviso es un adelanto de dos líneas y
 * copiar un mensaje de veinte mil caracteres por cada uno solo engorda la tabla.
 */
const MAX_CUERPO = 160;

function adelanto(texto: string | null | undefined): string | null {
  const limpio = texto?.replace(/\s+/g, " ").trim();
  if (!limpio) return null;

  return limpio.length > MAX_CUERPO
    ? `${limpio.slice(0, MAX_CUERPO - 1).trimEnd()}…`
    : limpio;
}

export type Aviso = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  url: string;
  readAt: Date | null;
  createdAt: Date;
};

const CAMPOS = {
  id: true,
  kind: true,
  title: true,
  body: true,
  url: true,
  readAt: true,
  createdAt: true,
} as const;

/**
 * Apunta un aviso.
 *
 * No lanza nunca: quien la llama está terminando de responder un hilo o de
 * resolver una solicitud, y ese trabajo no puede caerse porque falle un aviso.
 */
export async function crearAviso(aviso: {
  userId: string;
  tipo: TipoAviso;
  titulo: string;
  cuerpo?: string | null;
  url: string;
}): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId: aviso.userId,
        kind: aviso.tipo,
        title: aviso.titulo,
        body: adelanto(aviso.cuerpo),
        url: aviso.url,
      },
    });

    // Y su campana se entera al momento, sin esperar a que recargue.
    emitir(CANAL.usuario(aviso.userId));
  } catch (error) {
    console.error("No se pudo guardar el aviso", error);
  }
}

/**
 * Apunta el mismo aviso para todo el staff.
 *
 * Se usa para lo que es trabajo de cualquiera —una solicitud que entra— y no
 * de una persona concreta: el primero que la vea se la queda. Tampoco lanza,
 * por lo mismo que `crearAviso`.
 */
export async function avisarAlStaff(aviso: {
  tipo: TipoAviso;
  titulo: string;
  cuerpo?: string | null;
  url: string;
  /** Quien lo provoca no se avisa a sí mismo. */
  excepto?: string;
  /** Solo de este escalón para arriba. Sin él, todo el staff. */
  desdeNivel?: Role;
}): Promise<void> {
  try {
    const alcanzan = aviso.desdeNivel ? desde(aviso.desdeNivel) : ESCALONES;

    const staff = await db.user.findMany({
      where: {
        role: { in: alcanzan },
        ...(aviso.excepto ? { id: { not: aviso.excepto } } : {}),
      },
      select: { id: true },
    });
    if (staff.length === 0) return;

    const cuerpo = adelanto(aviso.cuerpo);

    await db.notification.createMany({
      data: staff.map((persona) => ({
        userId: persona.id,
        kind: aviso.tipo,
        title: aviso.titulo,
        body: cuerpo,
        url: aviso.url,
      })),
    });

    emitirA(staff.map((persona) => CANAL.usuario(persona.id)));
  } catch (error) {
    console.error("No se pudo avisar al staff", error);
  }
}

/** Lo que necesita la campana: cuántos sin leer y los últimos. */
export async function resumenAvisos(userId: string) {
  const [sinLeer, ultimos] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: EN_CAMPANA,
      select: CAMPOS,
    }),
  ]);

  return { sinLeer, ultimos };
}

/** Página del historial completo. */
export async function listarAvisos(userId: string, salta: number, toma: number) {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: salta,
    take: toma,
    select: CAMPOS,
  });
}

export function contarAvisos(userId: string) {
  return db.notification.count({ where: { userId } });
}
