import { Check, CircleDot, Clock, MessageSquareDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Role, TicketStatus } from "@/generated/prisma/enums";

/**
 * El estado de un ticket dice de quién es el turno.
 *
 * Y como el turno de uno es la espera del otro, cada estado se llama distinto
 * según quién mire: lo que para el staff es «nos toca», para el jugador es
 * «esperando al staff». Decirlo igual a los dos era lo que no se entendía.
 */
const ESTADO = {
  ABIERTO: {
    staff: "Sin abrir",
    jugador: "Esperando al staff",
    explicaStaff: "Nadie lo ha tocado todavía.",
    explicaJugador: "Lo hemos recibido. Aún no lo ha cogido nadie.",
    tono: "pending",
    Icono: CircleDot,
  },
  EN_CURSO: {
    staff: "Nos toca",
    jugador: "Esperando al staff",
    explicaStaff: "El jugador ha escrito lo último. Le debemos respuesta.",
    explicaJugador: "Lo estamos mirando. Te contestamos aquí mismo.",
    tono: "review",
    Icono: MessageSquareDot,
  },
  ESPERANDO: {
    staff: "Con el jugador",
    jugador: "Te toca responder",
    explicaStaff: "Hemos contestado y esperamos al jugador.",
    explicaJugador: "Te hemos contestado. Responde para seguir.",
    tono: "neutral",
    Icono: Clock,
  },
  CERRADO: {
    staff: "Cerrado",
    jugador: "Cerrado",
    explicaStaff: "Resuelto. Nadie puede escribir hasta que se reabra.",
    explicaJugador: "Resuelto. Si te queda algo, abre otro ticket.",
    tono: "accepted",
    Icono: Check,
  },
} as const;

export type VistaTicket = "staff" | "jugador";

export function EstadoTicket({
  status,
  vista = "staff",
}: {
  status: TicketStatus;
  vista?: VistaTicket;
}) {
  const estado = ESTADO[status];

  return (
    <Badge tono={estado.tono}>
      <estado.Icono size={13} aria-hidden />
      {vista === "jugador" ? estado.jugador : estado.staff}
    </Badge>
  );
}

/** La frase que acompaña al estado dentro de la ficha del ticket. */
export function explicaEstado(status: TicketStatus, vista: VistaTicket) {
  const estado = ESTADO[status];
  return vista === "jugador" ? estado.explicaJugador : estado.explicaStaff;
}

export function textoEstado(status: TicketStatus, vista: VistaTicket) {
  return vista === "jugador" ? ESTADO[status].jugador : ESTADO[status].staff;
}

const NIVEL_TEXTO: Partial<Record<Role, string>> = {
  INICIADOR: "Iniciadores",
  SOPORTE: "Soporte",
  MODERADOR: "Moderación",
  ADMIN: "Administración",
};

/** En qué escalón está el ticket. Solo tiene sentido dentro del panel. */
export function NivelTicket({ nivel }: { nivel: Role }) {
  return <Badge tono="neutral">{NIVEL_TEXTO[nivel] ?? nivel}</Badge>;
}

export { NIVEL_TEXTO };
