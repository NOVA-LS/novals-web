import "server-only";
import { db } from "@/lib/db";

/**
 * Registro de lo que hace el staff.
 *
 * Solo lo que cambia algo para otra persona: ascender, resolver, cerrar, borrar.
 * Leer no se apunta —sería ruido— y lo que hace un jugador sobre lo suyo,
 * tampoco: ya queda en sus propios datos.
 *
 * Nunca lanza. Un registro perdido es un problema; que un ascenso falle porque
 * no se pudo escribir el registro, uno peor.
 */

export const ACCIONES = {
  ROL: "rol",
  EQUIPOS: "equipos",
  SOLICITUD: "solicitud",
  TICKET: "ticket",
  FORO: "foro",
  CONTENIDO: "contenido",
  FORMULARIO: "formulario",
} as const;

export type Accion = (typeof ACCIONES)[keyof typeof ACCIONES];

export const ACCION_TEXTO: Record<Accion, string> = {
  rol: "Roles",
  equipos: "Equipos",
  solicitud: "Solicitudes",
  ticket: "Tickets",
  foro: "Foro",
  contenido: "Contenido",
  formulario: "Formularios",
};

export async function apuntar(registro: {
  accion: Accion;
  /** Quién lo hizo. Sin él, lo hizo el propio sistema. */
  actor?: { id: string; username: string } | null;
  /** Sobre qué, dicho para leerlo dentro de un año. */
  objetivo: string;
  url?: string;
  detalle?: string;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        accion: registro.accion,
        actorId: registro.actor?.id ?? null,
        actorNombre: registro.actor?.username ?? "Sistema",
        objetivo: registro.objetivo,
        url: registro.url ?? null,
        detalle: registro.detalle ?? null,
      },
    });
  } catch (error) {
    console.error("No se pudo apuntar en el registro", error);
  }
}
