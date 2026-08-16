import "server-only";

type Ventana = { conteo: number; expira: number };

// Límite en memoria del proceso. Basta porque la app corre en un único
// contenedor; el freno duradero contra el spam es el cooldown en base de datos.
const ventanas = new Map<string, Ventana>();

// Una clave que se usa una vez y no se repite (p.ej. un ticket concreto) no
// vuelve a mirarse nunca más, así que nada la borraría sola. Cada tantas
// llamadas se recorre el mapa entero y se tira lo que ya caducó.
let llamadasDesdeBarrido = 0;
const CADA = 200;

function barrer(ahora: number) {
  llamadasDesdeBarrido += 1;
  if (llamadasDesdeBarrido < CADA) return;
  llamadasDesdeBarrido = 0;

  for (const [clave, ventana] of ventanas) {
    if (ventana.expira < ahora) ventanas.delete(clave);
  }
}

export function consumir(clave: string, maximo: number, ventanaMs: number) {
  const ahora = Date.now();
  barrer(ahora);

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
