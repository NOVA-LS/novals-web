import type { Status } from "@/generated/prisma/enums";

export const DIA_MS = 24 * 60 * 60 * 1000;

export type UltimaSolicitud = {
  status: Status;
  resolvedAt: Date | null;
} | null;

export type Veredicto =
  | { permitido: true }
  | {
      permitido: false;
      motivo: string;
      /** Solo en el bloqueo por espera: cuándo se levanta. */
      hasta?: Date;
    };

/**
 * Decide si un usuario puede enviar una solicitud de un tipo.
 * Pura a propósito: es la regla que más duele si falla, y así se puede probar
 * sin base de datos.
 */
export function puedeEnviar({
  abierto,
  ultima,
  cooldownDays,
  ahora = new Date(),
}: {
  abierto: boolean;
  ultima: UltimaSolicitud;
  cooldownDays: number;
  ahora?: Date;
}): Veredicto {
  if (!abierto) {
    return { permitido: false, motivo: "Este formulario está cerrado ahora mismo." };
  }

  if (ultima && (ultima.status === "PENDING" || ultima.status === "IN_REVIEW")) {
    return {
      permitido: false,
      motivo: "Ya tienes una solicitud de este tipo en revisión.",
    };
  }

  if (ultima?.status === "REJECTED" && ultima.resolvedAt && cooldownDays > 0) {
    const disponible = ultima.resolvedAt.getTime() + cooldownDays * DIA_MS;
    if (ahora.getTime() < disponible) {
      const restantes = Math.ceil((disponible - ahora.getTime()) / DIA_MS);
      return {
        permitido: false,
        motivo: `Tu última solicitud fue rechazada. Podrás reenviarla en ${restantes} día(s).`,
        hasta: new Date(disponible),
      };
    }
  }

  return { permitido: true };
}
