import type { Role, TicketStatus } from "@/generated/prisma/enums";

/**
 * Quién puede hacer qué con un ticket.
 *
 * Módulo puro: no toca base de datos ni sesión. Recibe quién mira y el ticket,
 * y responde. Así las mismas reglas valen para pintar un botón y para decidir
 * si una acción se ejecuta, sin escribirlas dos veces.
 */

/** Escalones de staff, del más bajo al más alto. Es el orden del escalado. */
export const NIVELES: Role[] = ["INICIADOR", "SOPORTE", "MODERADOR", "ADMIN"];

const ALTURA: Record<Role, number> = {
  USER: 0,
  INICIADOR: 1,
  SOPORTE: 2,
  MODERADOR: 3,
  ADMIN: 4,
};

export type ActorTicket = { id: string; role: Role } | null;

export type TicketVisto = {
  authorId: string;
  nivel: Role;
  status: TicketStatus;
  /** Otros jugadores metidos en la conversación. Vacío si va solo. */
  invitados?: string[];
  /** La nota que ya le puso su autor, si es que la puso. */
  valoracion?: number | null;
};

/**
 * Llega al escalón que atiende el ticket, y no es quien lo abrió.
 *
 * Un miembro del staff puede escribir un ticket como jugador —tiene un
 * problema en el juego igual que cualquiera—, pero eso no le da poder de
 * staff sobre su propio caso: no debe poder asignárselo, moverlo de escalón,
 * invitar a nadie ni dejar notas internas en algo que en realidad le
 * concierne a él. Ese ticket lo lleva otro del staff, no él mismo.
 */
export function atiende(actor: ActorTicket, ticket: TicketVisto): boolean {
  if (!actor) return false;
  if (actor.id === ticket.authorId) return false;
  return ALTURA[actor.role] >= ALTURA[ticket.nivel];
}

export function esAutor(actor: ActorTicket, ticket: TicketVisto): boolean {
  return actor?.id === ticket.authorId;
}

/** Metido en la conversación por el autor o por el staff. */
export function esInvitado(actor: ActorTicket, ticket: TicketVisto): boolean {
  if (!actor) return false;
  return (ticket.invitados ?? []).includes(actor.id);
}

/** Del lado del jugador: el que lo abrió o cualquiera de los que van con él. */
export function esParte(actor: ActorTicket, ticket: TicketVisto): boolean {
  return esAutor(actor, ticket) || esInvitado(actor, ticket);
}

/**
 * Un ticket lo ven su autor y el staff que llega a su nivel. Nadie más: aquí
 * dentro hay reportes con nombres y consultas de pagos.
 */
export function puedeVer(actor: ActorTicket, ticket: TicketVisto): boolean {
  return esParte(actor, ticket) || atiende(actor, ticket);
}

/**
 * Un ticket cerrado no admite más mensajes, ni del jugador ni del staff.
 *
 * Cerrar tiene que significar algo: si escribir lo reabriese, un «gracias» de
 * cortesía devolvería a la bandeja algo ya resuelto. Para seguir hablando, el
 * staff lo reabre a propósito o el jugador abre otro.
 */
export function puedeEscribir(actor: ActorTicket, ticket: TicketVisto): boolean {
  if (ticket.status === "CERRADO") return false;
  return puedeVer(actor, ticket);
}

/**
 * Puntuar la atención recibida.
 *
 * Solo el autor y solo con el ticket cerrado: se valora lo que ya terminó, y
 * quien puede hablar de cómo le atendieron es quien vino a que le atendieran.
 * Los invitados no —entraron a una conversación ajena— y el staff tampoco.
 *
 * Y una sola vez. Una nota que se puede rehacer deja de ser lo que se pensó al
 * cerrar el ticket y pasa a ser lo que se opina hoy, que no es lo mismo; además,
 * poder cambiarla convierte cualquier conversación posterior con el staff en una
 * negociación sobre la nota.
 */
export function puedeValorar(actor: ActorTicket, ticket: TicketVisto): boolean {
  if (ticket.valoracion !== null && ticket.valoracion !== undefined) return false;
  return ticket.status === "CERRADO" && esAutor(actor, ticket);
}

/** Volver a abrir uno cerrado. Es decisión del staff que lo atiende. */
export function puedeReabrir(actor: ActorTicket, ticket: TicketVisto): boolean {
  return ticket.status === "CERRADO" && atiende(actor, ticket);
}

/**
 * Meter a alguien más en la conversación, o sacarlo.
 *
 * Solo el staff que atiende. El jugador dice con quién va al abrir el ticket
 * —ahí es donde sabe quién estaba delante— y a partir de ese momento quién entra
 * y quién sale es decisión de quien lo lleva: dentro hay nombres de terceros y
 * respuestas del staff.
 */
export function puedeInvitar(actor: ActorTicket, ticket: TicketVisto): boolean {
  if (ticket.status === "CERRADO") return false;
  return atiende(actor, ticket);
}

/** Las notas internas son cosa del staff que lleva el ticket. */
export function puedeEscribirInterno(
  actor: ActorTicket,
  ticket: TicketVisto,
): boolean {
  return atiende(actor, ticket);
}

/** Cerrar puede el staff, y también el autor si ya no necesita nada. */
export function puedeCerrar(actor: ActorTicket, ticket: TicketVisto): boolean {
  if (ticket.status === "CERRADO") return false;
  // Cerrar es cosa de quien lo abrió o del staff: un invitado está de paso.
  return esAutor(actor, ticket) || atiende(actor, ticket);
}

/** El escalón de encima, o null si ya está arriba del todo. */
export function siguienteNivel(nivel: Role): Role | null {
  const posicion = NIVELES.indexOf(nivel);
  if (posicion === -1) return null;
  return NIVELES[posicion + 1] ?? null;
}

/** El escalón de debajo, o null si ya está en el primero. */
export function nivelAnterior(nivel: Role): Role | null {
  const posicion = NIVELES.indexOf(nivel);
  if (posicion <= 0) return null;
  return NIVELES[posicion - 1] ?? null;
}

/**
 * Mover un ticket de escalón solo lo hace quien lo está atendiendo, y solo a un
 * escalón contiguo: los saltos se dan de uno en uno para que cada nivel tenga la
 * oportunidad de resolverlo.
 *
 * Bajarlo también vale, y es a propósito: si algo entró como reporte y era una
 * duda, devolverlo a soporte lo saca de la bandeja de moderación aunque quien lo
 * baja pierda la vista.
 */
export function puedeMover(
  actor: ActorTicket,
  ticket: TicketVisto,
  destino: Role,
): boolean {
  if (!atiende(actor, ticket)) return false;
  if (!NIVELES.includes(destino)) return false;

  return destino === siguienteNivel(ticket.nivel) || destino === nivelAnterior(ticket.nivel);
}

/**
 * En qué estado queda el ticket después de un mensaje.
 *
 * La idea es que el estado diga de quién es el turno: si contesta el staff, se
 * espera al jugador; si contesta el jugador, la pelota vuelve al staff. Una nota
 * interna no cambia nada porque el jugador ni la ve.
 */
export function estadoTrasMensaje(
  ticket: TicketVisto,
  quienEscribe: "autor" | "staff",
  interno = false,
): TicketStatus {
  if (interno) return ticket.status;
  return quienEscribe === "staff" ? "ESPERANDO" : "EN_CURSO";
}
