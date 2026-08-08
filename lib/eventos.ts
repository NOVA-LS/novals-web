import "server-only";

/**
 * Aviso en vivo de que algo ha cambiado.
 *
 * No lleva datos: solo dice «el ticket 7 se ha movido» y quien escucha vuelve a
 * pedir la página. Así el servidor sigue siendo el único que sabe qué puede ver
 * cada uno, y por el canal no viaja nada privado.
 *
 * Vive en memoria del proceso, como el límite de peticiones: la web corre en un
 * contenedor. Con dos, cada uno avisaría solo a los suyos y el resto se
 * enteraría en la siguiente carga, que es exactamente lo de antes.
 */

type Oyente = () => void;

declare global {
  // El hot reload reevalúa el módulo; sin esto cada recarga estrenaría un bus
  // vacío y los oyentes de antes se quedarían hablando solos.
  var __novaEventos: Map<string, Set<Oyente>> | undefined;
}

const canales = (globalThis.__novaEventos ??= new Map());

/** Avisa a quien esté escuchando ese canal. */
export function emitir(canal: string) {
  const oyentes = canales.get(canal);
  if (!oyentes) return;

  for (const oyente of oyentes) {
    try {
      oyente();
    } catch (error) {
      console.error(`Un oyente de ${canal} falló`, error);
    }
  }
}

/** Avisa a varios canales de una vez. Los repetidos se avisan una sola vez. */
export function emitirA(canales: string[]) {
  for (const canal of new Set(canales)) emitir(canal);
}

/** Se apunta a un canal. Devuelve cómo darse de baja. */
export function escuchar(canal: string, oyente: Oyente): () => void {
  const oyentes = canales.get(canal) ?? new Set<Oyente>();
  oyentes.add(oyente);
  canales.set(canal, oyentes);

  return () => {
    oyentes.delete(oyente);
    // Un canal sin nadie no tiene por qué seguir ocupando sitio.
    if (oyentes.size === 0) canales.delete(canal);
  };
}

/** Los nombres de canal, en un sitio, para que no se escriban a mano. */
export const CANAL = {
  /** Sus avisos y su rol: lo que cambia la cabecera de esa persona. */
  usuario: (userId: string) => `usuario:${userId}`,
  /** Un ticket concreto: mensajes, presencia y estado. */
  ticket: (ticketId: string) => `ticket:${ticketId}`,
  /** Las bandejas del staff: tickets y solicitudes que entran o se mueven. */
  panel: () => "panel",
  /** El foro entero: hilos nuevos y respuestas. */
  foro: () => "foro",
} as const;
