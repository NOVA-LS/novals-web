import { clamp, EMBED_COLOR, type Embed } from "@/lib/embed";

/**
 * Texto de los avisos que recibe el usuario por privado.
 *
 * Puro a propósito: no toca red ni base de datos, así que lo que lee la gente se
 * puede probar entero. Quien lo llama se encarga de entregarlo.
 */

export type Aviso =
  | { evento: "recibida"; formTitle: string }
  | { evento: "en_revision"; formTitle: string }
  | {
      evento: "resuelta";
      formTitle: string;
      estado: "ACCEPTED" | "REJECTED";
      nota: string | null;
      cooldownDays: number;
    };

export function construirAviso(aviso: Aviso, enlace: string): Embed {
  switch (aviso.evento) {
    case "recibida":
      return {
        title: `Recibimos tu solicitud · ${aviso.formTitle}`,
        url: enlace,
        color: EMBED_COLOR.pending,
        description:
          "Ya está en la cola. La lee una persona del staff, no un bot, así que " +
          "tarda lo que tarda. Te escribo por aquí en cuanto haya novedades.",
      };

    case "en_revision":
      return {
        title: `En revisión · ${aviso.formTitle}`,
        url: enlace,
        color: EMBED_COLOR.neutral,
        description:
          "Alguien del staff está leyendo tu solicitud ahora mismo. El próximo " +
          "aviso ya será la respuesta.",
      };

    case "resuelta":
      return aviso.estado === "ACCEPTED"
        ? aceptada(aviso, enlace)
        : rechazada(aviso, enlace);
  }
}

type Resuelta = Extract<Aviso, { evento: "resuelta" }>;

function aceptada(aviso: Resuelta, enlace: string): Embed {
  return {
    title: `Aceptada · ${aviso.formTitle}`,
    url: enlace,
    color: EMBED_COLOR.accepted,
    description: "Tu solicitud ha sido aceptada. Nos vemos en la ciudad.",
    fields: notaDelStaff(aviso.nota),
  };
}

function rechazada(aviso: Resuelta, enlace: string): Embed {
  return {
    title: `Rechazada · ${aviso.formTitle}`,
    url: enlace,
    color: EMBED_COLOR.rejected,
    description: aviso.nota
      ? "Esta vez no ha salido. En la nota del staff está lo que ha faltado."
      : "Esta vez no ha salido. El staff no ha dejado nota.",
    fields: [...notaDelStaff(aviso.nota), ...cuandoReenviar(aviso.cooldownDays)],
  };
}

function notaDelStaff(nota: string | null): NonNullable<Embed["fields"]> {
  const texto = nota?.trim();
  return texto ? [{ name: "Nota del staff", value: clamp(texto) }] : [];
}

function cuandoReenviar(cooldownDays: number): NonNullable<Embed["fields"]> {
  return [
    {
      name: "Cuándo puedes reenviarla",
      value:
        cooldownDays > 0
          ? `Dentro de ${cooldownDays} día(s), contando desde hoy.`
          : "Cuando quieras, no hay espera.",
    },
  ];
}
