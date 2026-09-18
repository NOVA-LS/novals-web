/**
 * Reparto en páginas de las listas largas.
 *
 * Módulo puro: no toca la base de datos ni la petición. Recibe cuántos
 * elementos hay y cuál se ha pedido, y devuelve lo que necesita la consulta
 * (`salta`, `toma`) y lo que necesita la barra de navegación.
 */

/** Cuántos elementos entran en una página, por tipo de lista. */
export const POR_PAGINA = {
  noticias: 12,
  hilos: 25,
  respuestas: 20,
  tickets: 25,
  /* Las del panel: se trabaja con ellas, así que caben más de una tacada. */
  solicitudes: 30,
  usuarios: 30,
  valoraciones: 25,
  noticiasPanel: 20,
  galeria: 24,
  /* La conversación de un ticket. Se entra por la última página, que es la que
     tiene lo último que se dijo. */
  mensajes: 30,
} as const;

/**
 * La última página, para las listas que se leen del final hacia atrás.
 *
 * Se pasa a `paginar`, que recorta cualquier número al máximo que exista: así
 * «sin página pedida» significa «la última» sin tener que contar dos veces.
 */
export const ULTIMA = Number.MAX_SAFE_INTEGER;

export type Pagina = {
  /** La que se está viendo. Siempre entre 1 y `paginas`. */
  actual: number;
  paginas: number;
  total: number;
  /** Para `skip` de Prisma. */
  salta: number;
  /** Para `take` de Prisma. */
  toma: number;
};

/**
 * Traduce el parámetro de la URL a un número de página.
 *
 * Cualquier cosa rara —vacío, letras, cero, negativo, decimales— cae en la
 * primera página: una URL manipulada no debe romper la lista.
 */
export function leerPagina(valor: string | string[] | undefined): number {
  if (typeof valor !== "string" || valor.trim() === "") return 1;

  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1) return 1;

  return numero;
}

/**
 * Reparte `total` elementos y sitúa la página pedida.
 *
 * Pedir una página que se ha quedado sin elementos (porque se borraron mientras
 * tanto, o porque alguien escribió a mano `?p=999`) devuelve la última: es más
 * útil que una lista vacía sin explicación.
 */
export function paginar(total: number, porPagina: number, pedida: number): Pagina {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(Math.max(1, pedida), paginas);

  return {
    actual,
    paginas,
    total,
    salta: (actual - 1) * porPagina,
    toma: porPagina,
  };
}

/** En qué página cae el elemento que ocupa la posición `indice` (desde 0). */
export function paginaDe(indice: number, porPagina: number): number {
  return Math.floor(Math.max(0, indice) / porPagina) + 1;
}

/**
 * Los números que se enseñan en la barra: los de alrededor de la actual, más el
 * primero y el último siempre. Los saltos se marcan con un hueco.
 *
 * Con pocas páginas salen todas; el hueco solo aparece cuando de verdad se está
 * saltando algo, nunca para esconder una sola página.
 */
export function ventana(
  actual: number,
  paginas: number,
  radio = 1,
): (number | "hueco")[] {
  const visibles = new Set<number>([1, paginas]);
  for (let n = actual - radio; n <= actual + radio; n++) {
    if (n >= 1 && n <= paginas) visibles.add(n);
  }

  const ordenadas = [...visibles].sort((a, b) => a - b);
  const salida: (number | "hueco")[] = [];

  for (const [posicion, numero] of ordenadas.entries()) {
    const anterior = ordenadas[posicion - 1];
    if (anterior !== undefined) {
      // Un solo número escondido ocupa lo mismo que el hueco: se enseña.
      if (numero - anterior === 2) salida.push(anterior + 1);
      else if (numero - anterior > 2) salida.push("hueco");
    }
    salida.push(numero);
  }

  return salida;
}
