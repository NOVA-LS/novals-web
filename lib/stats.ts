export const HORA_MS = 60 * 60 * 1000;
export const DIA_MS = 24 * HORA_MS;

/**
 * Días enteros transcurridos desde una fecha.
 *
 * La referencia es un parámetro con valor por defecto para poder fijar el
 * instante en las pruebas.
 */
export function diasDesde(fecha: Date, referencia = new Date()): number {
  return Math.floor((referencia.getTime() - fecha.getTime()) / DIA_MS);
}

/** Momento de hace N días, para acotar consultas por ventana temporal. */
export function haceDias(dias: number, referencia = new Date()): Date {
  return new Date(referencia.getTime() - dias * DIA_MS);
}

export type Resuelta = {
  createdAt: Date;
  resolvedAt: Date | null;
};

/**
 * Tiempo medio que tarda el staff en contestar, en horas.
 *
 * Puro y aparte de la consulta para poder probar los casos que importan: sin
 * datos, con fechas incoherentes y con la mezcla de resueltas y pendientes.
 * Devuelve null cuando no hay nada que promediar, y quien lo llama decide si
 * enseña el dato o esconde la cifra.
 */
export function mediaDeRespuestaHoras(solicitudes: Resuelta[]): number | null {
  const tiempos = solicitudes
    .filter((solicitud) => solicitud.resolvedAt !== null)
    .map((solicitud) => solicitud.resolvedAt!.getTime() - solicitud.createdAt.getTime())
    // Una resolución anterior al envío solo puede venir de un reloj torcido.
    .filter((ms) => ms >= 0);

  if (tiempos.length === 0) return null;

  const media = tiempos.reduce((total, ms) => total + ms, 0) / tiempos.length;
  return media / HORA_MS;
}

/** Redondea el tiempo de respuesta a algo que se lea de un vistazo. */
export function textoDeRespuesta(horas: number | null): string | null {
  if (horas === null) return null;

  if (horas < 1) return "menos de 1 h";
  if (horas < 48) return `${Math.round(horas)} h`;

  return `${Math.round(horas / 24)} días`;
}

/**
 * Una media de valoración, dicha como se dice en voz alta.
 *
 * Un 5 redondo es un 5, no un «5.0»: el decimal solo tiene sentido cuando hay
 * algo detrás de la coma.
 */
export function notaMedia(valor: number | null): string {
  if (valor === null) return "—";
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1);
}
