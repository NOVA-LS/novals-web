import { clamp, EMBED_COLOR, type Embed } from "@/lib/embed";

/**
 * Texto de los avisos de ticket que recibe el usuario por privado.
 *
 * Igual que `mensajes.ts` para las solicitudes: puro a propósito, para poder
 * probar lo que lee la gente sin arrastrar red ni base de datos.
 */

export type AvisoTicket =
  | { evento: "mensaje"; numero: number; asunto: string; autor: string; texto: string }
  | { evento: "cerrado"; numero: number; asunto: string }
  | { evento: "reabierto"; numero: number; asunto: string }
  | { evento: "invitado"; numero: number; asunto: string; quien: string };

export function construirAvisoTicket(aviso: AvisoTicket, enlace: string): Embed {
  switch (aviso.evento) {
    case "mensaje":
      return {
        title: `Respuesta en tu ticket #${aviso.numero}`,
        url: enlace,
        color: EMBED_COLOR.neutral,
        description: `**${aviso.autor}** te ha respondido en «${aviso.asunto}».`,
        fields: [{ name: "Mensaje", value: clamp(aviso.texto) }],
      };

    case "cerrado":
      return {
        title: `Tu ticket #${aviso.numero} se ha cerrado`,
        url: enlace,
        color: EMBED_COLOR.accepted,
        description: `«${aviso.asunto}». Si te queda algo por resolver, abre otro.`,
      };

    case "reabierto":
      return {
        title: `Tu ticket #${aviso.numero} se ha reabierto`,
        url: enlace,
        color: EMBED_COLOR.pending,
        description: `«${aviso.asunto}». Alguien del staff sigue con ello.`,
      };

    case "invitado":
      return {
        title: `Te han metido en el ticket #${aviso.numero}`,
        url: enlace,
        color: EMBED_COLOR.neutral,
        description: `**${aviso.quien}** te ha metido en «${aviso.asunto}».`,
      };
  }
}
