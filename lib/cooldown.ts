/**
 * Formato de la espera que queda antes de poder reenviar una solicitud.
 *
 * Módulo puro: lo usan a la vez el servidor, que pinta el primer valor, y el
 * contador del navegador, que lo refresca. Si cada uno lo formateara a su
 * manera, el número daría un salto raro al hidratar.
 */

const SEGUNDO_MS = 1000;
const MINUTO_MS = 60 * SEGUNDO_MS;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;

/** Milisegundos que faltan, nunca negativos. */
export function esperaRestante(hasta: Date, ahora: Date = new Date()): number {
  return Math.max(0, hasta.getTime() - ahora.getTime());
}

export type Desglose = {
  dias: number;
  horas: number;
  minutos: number;
  segundos: number;
};

export type EstadoEspera = { desglose: Desglose; avance: number; texto: string };

/**
 * Todo lo que hay que saber de la espera en un instante dado.
 *
 * Vive aquí y no en el componente porque lo llaman los dos lados: el servidor
 * para el primer pintado y el navegador para cada segundo siguiente. Lo que
 * exporta un módulo «use client» no se puede llamar desde el servidor.
 */
export function calcularEspera(
  hasta: number,
  desde: number | null,
  ahora: Date = new Date(),
): EstadoEspera {
  const fin = new Date(hasta);
  const restante = esperaRestante(fin, ahora);

  return {
    desglose: desglosarEspera(restante),
    avance: avanceEspera(desde === null ? null : new Date(desde), fin, ahora),
    texto: formatearEspera(restante),
  };
}

/** La misma espera partida en unidades, para enseñarla como cuenta atrás. */
export function desglosarEspera(restanteMs: number): Desglose {
  const restante = Math.max(0, restanteMs);

  return {
    dias: Math.floor(restante / DIA_MS),
    horas: Math.floor((restante % DIA_MS) / HORA_MS),
    minutos: Math.floor((restante % HORA_MS) / MINUTO_MS),
    segundos: Math.floor((restante % MINUTO_MS) / SEGUNDO_MS),
  };
}

/**
 * Parte de la espera ya cumplida, de 0 a 1.
 *
 * Sin fecha de inicio no hay barra que dibujar: devuelve 0 en vez de inventarse
 * un punto de partida.
 */
export function avanceEspera(
  desde: Date | null,
  hasta: Date,
  ahora: Date = new Date(),
): number {
  if (!desde) return 0;

  const total = hasta.getTime() - desde.getTime();
  if (total <= 0) return 1;

  const hecho = (ahora.getTime() - desde.getTime()) / total;
  return Math.min(1, Math.max(0, hecho));
}

/**
 * Dos unidades como mucho: «3 días · 4 h» dice lo mismo que «3 d 4 h 12 min 8 s»
 * y se lee de un vistazo. Solo cuando queda menos de un minuto se enseñan los
 * segundos sueltos, que es cuando de verdad importan.
 *
 * Las unidades van separadas por un punto medio y la primera con la palabra
 * entera: en la tipografía condensada de la casa, «3 d 4 h» se leía como un
 * único número pegado.
 */
export function formatearEspera(restanteMs: number): string {
  if (restanteMs <= 0) return "ya";

  const { dias, horas, minutos, segundos } = desglosarEspera(restanteMs);

  if (dias > 0) return `${dias} ${dias === 1 ? "día" : "días"} · ${horas} h`;
  if (horas > 0) return `${horas} ${horas === 1 ? "hora" : "horas"} · ${minutos} min`;
  if (minutos > 0) return `${minutos} min · ${segundos} s`;
  return `${segundos} s`;
}
