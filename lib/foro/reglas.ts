import { alcanza } from "@/lib/roles";
import type { Role } from "@/generated/prisma/enums";

/**
 * Quién puede hacer qué en el foro.
 *
 * Puras a propósito: son las reglas que deciden si alguien escribe, edita o
 * borra, y conviene poder probarlas sin base de datos ni sesión.
 */

export type Actor = {
  id: string;
  role: Role;
  /** Si tiene una whitelist aceptada. El staff no la necesita. */
  tieneWhitelist: boolean;
};

export type Autoria = {
  authorId: string;
};

export type Hilo = Autoria & {
  locked: boolean;
};

function esStaff(role: Role) {
  return role !== "USER";
}

/**
 * A partir de dónde se modera.
 *
 * El iniciador queda fuera a propósito: su trabajo es corregir historias y
 * whitelist, no decidir qué hilo se cierra ni qué mensaje ajeno desaparece.
 */
const MODERA_DESDE: Role = "SOPORTE";

function modera(role: Role) {
  return alcanza(role, MODERA_DESDE);
}

/** Leer es público; escribir pide haber pasado la whitelist. */
export function puedePublicar(actor: Actor | null): boolean {
  if (!actor) return false;
  return actor.tieneWhitelist || esStaff(actor.role);
}

/**
 * Responder exige, además, que el hilo no esté cerrado. Quien modera sí puede
 * escribir en un hilo cerrado: cerrarlo es zanjar la conversación, no impedir
 * que quien lo cerró deje la última palabra.
 */
export function puedeResponder(actor: Actor | null, hilo: Hilo): boolean {
  if (!puedePublicar(actor)) return false;
  if (!hilo.locked) return true;
  return modera(actor!.role);
}

/** Cada cual edita lo suyo. El staff no edita mensajes ajenos: los borra. */
export function puedeEditar(actor: Actor | null, contenido: Autoria): boolean {
  if (!actor) return false;
  return actor.id === contenido.authorId;
}

/** Lo tuyo siempre; lo de otro, solo quien modera. */
export function puedeBorrar(actor: Actor | null, contenido: Autoria): boolean {
  if (!actor) return false;
  return actor.id === contenido.authorId || modera(actor.role);
}

/** Fijar y cerrar hilos: del escalón de soporte hacia arriba. */
export function puedeModerar(actor: Actor | null): boolean {
  return Boolean(actor && modera(actor.role));
}

/** Conceder y retirar insignias, solo administración. */
export function puedeConcederInsignias(actor: Actor | null): boolean {
  return actor?.role === "ADMIN";
}
