import "server-only";
import { enviarDM, notifyStaff } from "@/lib/discord";
import { EMBED_COLOR } from "@/lib/embed";
import { construirAviso, type Aviso } from "@/lib/notifications/mensajes";
import { construirAvisoTicket, type AvisoTicket } from "@/lib/notifications/tickets";

export type { Aviso } from "@/lib/notifications/mensajes";
export type { AvisoTicket } from "@/lib/notifications/tickets";

/**
 * Avisa por privado de Discord del estado de una solicitud.
 *
 * Nunca lanza: un aviso perdido no puede tumbar el envío ni la resolución de una
 * solicitud. Si el privado no llega, el canal de staff se entera para que se lo
 * digan a mano.
 */
export async function avisarUsuario(
  discordId: string,
  aviso: Aviso,
  /** A qué solicitud enlaza el aviso: el privado lleva a esa, no a la lista entera. */
  solicitudId: string,
): Promise<void> {
  const resultado = await enviarDM(discordId, construirAviso(aviso, urlSolicitud(solicitudId)));

  // Sin bot configurado no hay nada que avisar ni nada roto que reportar.
  if (resultado.ok || resultado.motivo === "SIN_TOKEN") return;

  await notifyStaff({
    title: "No se pudo avisar por privado",
    color: EMBED_COLOR.pending,
    description:
      `<@${discordId}> no ha recibido el aviso de su solicitud ` +
      `(**${aviso.formTitle}**). Habrá que decírselo a mano.`,
    fields: [
      {
        name: "Motivo",
        value:
          resultado.motivo === "BLOQUEADO"
            ? "Tiene los mensajes directos cerrados o no comparte servidor con el bot."
            : (resultado.detalle ?? "Error al hablar con Discord."),
      },
    ],
  });
}

/**
 * Avisa por privado de Discord de la actividad de un ticket: mensaje nuevo,
 * cerrado, reabierto o invitación. La misma idea que `avisarUsuario`, pero
 * hacia `/tickets/[id]` en vez de hacia el perfil.
 */
export async function avisarUsuarioTicket(
  discordId: string,
  aviso: AvisoTicket,
  ticketId: string,
): Promise<void> {
  const resultado = await enviarDM(discordId, construirAvisoTicket(aviso, urlTicket(ticketId)));

  if (resultado.ok || resultado.motivo === "SIN_TOKEN") return;

  await notifyStaff({
    title: "No se pudo avisar por privado",
    color: EMBED_COLOR.pending,
    description:
      `<@${discordId}> no ha recibido el aviso de su ticket ` +
      `(**#${aviso.numero}**). Habrá que decírselo a mano.`,
    fields: [
      {
        name: "Motivo",
        value:
          resultado.motivo === "BLOQUEADO"
            ? "Tiene los mensajes directos cerrados o no comparte servidor con el bot."
            : (resultado.detalle ?? "Error al hablar con Discord."),
      },
    ],
  });
}

function base() {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** URL directa a una solicitud concreta, dentro de la lista del perfil. */
function urlSolicitud(id: string) {
  return `${base()}/perfil#solicitud-${id}`;
}

/** URL directa a un ticket concreto. */
function urlTicket(id: string) {
  return `${base()}/tickets/${id}`;
}
