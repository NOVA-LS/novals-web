import "server-only";

/**
 * Aplica una tarea a una lista, unas cuantas a la vez en vez de todas juntas
 * ni una a una.
 *
 * Un repaso masivo —sincronizar a todo el mundo con Discord, por ejemplo—
 * hecho `for...await` es secuencial de verdad: con cientos de usuarios son
 * cientos de ida y vueltas en fila, y encima cada una es una petición a una
 * API ajena con su propio límite de ritmo. Todas a la vez con `Promise.all`
 * sería peor: dispara el límite de Discord con seguridad. Un puñado a la vez
 * es el término medio.
 */
export async function enLotes<T, R>(
  items: T[],
  tamano: number,
  tarea: (item: T) => Promise<R>,
): Promise<R[]> {
  const resultados: R[] = [];

  for (let inicio = 0; inicio < items.length; inicio += tamano) {
    const lote = items.slice(inicio, inicio + tamano);
    resultados.push(...(await Promise.all(lote.map(tarea))));
  }

  return resultados;
}
