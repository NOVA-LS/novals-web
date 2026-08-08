import "server-only";

type Ventana = { conteo: number; expira: number };

// Límite en memoria del proceso. Basta porque la app corre en un único
// contenedor; el freno duradero contra el spam es el cooldown en base de datos.
const ventanas = new Map<string, Ventana>();

export function consumir(clave: string, maximo: number, ventanaMs: number) {
  const ahora = Date.now();
  const actual = ventanas.get(clave);

  if (!actual || actual.expira < ahora) {
    ventanas.set(clave, { conteo: 1, expira: ahora + ventanaMs });
    return { permitido: true, restante: maximo - 1 };
  }

  if (actual.conteo >= maximo) {
    return {
      permitido: false,
      restante: 0,
      esperaMs: actual.expira - ahora,
    };
  }

  actual.conteo += 1;
  return { permitido: true, restante: maximo - actual.conteo };
}
