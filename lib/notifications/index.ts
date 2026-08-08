import "server-only";
import { enviarDM, notifyStaff } from "@/lib/discord";
import { EMBED_COLOR } from "@/lib/embed";
import { construirAviso, type Aviso } from "@/lib/notifications/mensajes";

export type { Aviso } from "@/lib/notifications/mensajes";

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
): Promise<void> {
  const resultado = await enviarDM(discordId, construirAviso(aviso, misSolicitudes()));

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

/** URL pública de la pantalla donde el usuario ve el estado de sus solicitudes. */
function misSolicitudes() {
  const base = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/perfil`;
}
