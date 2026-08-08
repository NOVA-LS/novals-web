import type { Participante } from "@/components/tickets/participantes";
import type { Role } from "@/generated/prisma/enums";

/**
 * Quién está dentro de un ticket, en el orden en que se lee.
 *
 * Se compone aparte porque la lista no sale de una sola tabla: el autor viene
 * del ticket, los invitados de su tabla, y el staff no está apuntado en ningún
 * sitio —entra por su escalón— así que solo consta el que ha llegado a escribir.
 *
 * Módulo puro: recibe lo ya consultado y ordena. Así se puede probar sin base de
 * datos y las dos pantallas del ticket enseñan exactamente lo mismo.
 */

export type PersonaTicket = {
  id: string;
  username: string;
  avatar: string | null;
  role: Role;
};

export function componerParticipantes({
  autor,
  invitados,
  autoresDeMensajes,
  presentes = [],
}: {
  autor: PersonaTicket;
  invitados: PersonaTicket[];
  /** Quién ha escrito, en orden de aparición. Puede repetirse. */
  autoresDeMensajes: PersonaTicket[];
  /** Quiénes tienen el ticket abierto ahora mismo. */
  presentes?: PersonaTicket[];
}): Participante[] {
  const mirando = new Set(presentes.map((persona) => persona.id));

  const lista: Participante[] = [
    { ...autor, papel: "autor", mirando: mirando.has(autor.id) },
    ...invitados.map((persona) => ({
      ...persona,
      papel: "invitado" as const,
      mirando: mirando.has(persona.id),
    })),
  ];

  // El staff que haya escrito, sin repetir y sin colarse quien ya está arriba.
  const puestos = new Set(lista.map((persona) => persona.id));
  for (const persona of autoresDeMensajes) {
    if (puestos.has(persona.id)) continue;
    puestos.add(persona.id);
    lista.push({ ...persona, papel: "staff", mirando: mirando.has(persona.id) });
  }

  // Y quien está delante sin haber escrito todavía: no consta en ningún mensaje,
  // pero verlo ahí es justo lo que evita que dos contesten a la vez.
  for (const persona of presentes) {
    if (puestos.has(persona.id)) continue;
    puestos.add(persona.id);
    lista.push({ ...persona, papel: "staff", mirando: true });
  }

  return lista;
}
