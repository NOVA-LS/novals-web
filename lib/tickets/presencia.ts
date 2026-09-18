/**
 * Quién está mirando un ticket ahora mismo.
 *
 * Módulo puro: solo decide, a partir de una marca de tiempo, si a alguien se le
 * sigue considerando presente. La marca la deja la propia pantalla del ticket
 * mientras esté abierta.
 */

/** Cada cuánto avisa una pantalla abierta de que sigue ahí. */
export const LATIDO_SEGUNDOS = 20;

/**
 * Cuánto se aguanta a alguien tras su último latido.
 *
 * Tres latidos de margen: uno perdido por una recarga o por un segundo de mala
 * conexión no debe hacer desaparecer a quien sigue delante de la pantalla.
 */
export const MARGEN_MS = LATIDO_SEGUNDOS * 3 * 1000;

export function estaMirando(seenAt: Date, ahora: Date = new Date()): boolean {
  return ahora.getTime() - seenAt.getTime() <= MARGEN_MS;
}

/** Los identificadores de quienes siguen presentes. */
export function quienesMiran(
  presencias: { userId: string; seenAt: Date }[],
  ahora: Date = new Date(),
): Set<string> {
  return new Set(
    presencias
      .filter((presencia) => estaMirando(presencia.seenAt, ahora))
      .map((presencia) => presencia.userId),
  );
}
