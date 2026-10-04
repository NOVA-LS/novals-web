import { z } from "zod";

/**
 * Reglas de la encuesta de una noticia. Aparte de las acciones porque aquí no
 * entra `lib/db`, que revienta sin `DATABASE_URL`: así se prueban sin base de
 * datos, igual que `lib/noticias`.
 */

export const MIN_OPCIONES = 2;
export const MAX_OPCIONES = 6;
export const MAX_ETIQUETA = 80;
export const MAX_PREGUNTA = 120;

export type Resultado = { ok: true } | { ok: false; mensaje: string };

export const esquemaEncuesta = z.object({
  question: z
    .string()
    .trim()
    .max(MAX_PREGUNTA, `La pregunta admite ${MAX_PREGUNTA} caracteres como máximo.`)
    .transform((valor) => (valor === "" ? undefined : valor))
    .optional(),
  // `datetime-local` no lleva zona horaria: el editor la manda ya en ISO.
  closesAt: z
    .string()
    .trim()
    .refine(
      (valor) => valor === "" || !Number.isNaN(Date.parse(valor)),
      "La fecha de cierre no es válida.",
    )
    .transform((valor) => (valor === "" ? undefined : new Date(valor)))
    .optional(),
  options: z
    .array(
      z.object({
        // Vacío = opción nueva, todavía sin guardar.
        id: z
          .string()
          .trim()
          .optional()
          .transform((valor) => (valor ? valor : undefined)),
        label: z
          .string()
          .trim()
          .min(1, "Las opciones no pueden estar vacías.")
          .max(MAX_ETIQUETA, `Una opción admite ${MAX_ETIQUETA} caracteres como máximo.`),
      }),
    )
    .min(MIN_OPCIONES, `La encuesta necesita al menos ${MIN_OPCIONES} opciones.`)
    .max(MAX_OPCIONES, `La encuesta admite ${MAX_OPCIONES} opciones como máximo.`)
    .refine(
      (opciones) =>
        new Set(opciones.map((opcion) => opcion.label.toLowerCase())).size === opciones.length,
      "Hay opciones repetidas.",
    ),
});

export type EncuestaValida = z.output<typeof esquemaEncuesta>;

/** Abierta mientras no haya fecha de cierre o esta no haya llegado. */
export function encuestaAbierta(encuesta: { closesAt: Date | null }, ahora = new Date()) {
  return !encuesta.closesAt || encuesta.closesAt.getTime() > ahora.getTime();
}

export function puedeVotar(
  post: { published: boolean },
  encuesta: { closesAt: Date | null },
  ahora = new Date(),
): Resultado {
  if (!post.published) return { ok: false, mensaje: "Esta noticia no está publicada." };
  if (!encuestaAbierta(encuesta, ahora)) return { ok: false, mensaje: "La encuesta está cerrada." };
  return { ok: true };
}

/**
 * Una encuesta nueva no puede nacer ya cerrada; una que ya existe sí admite una
 * fecha pasada, que es la forma de cerrarla a mano.
 */
export function cierreValido(closesAt: Date | undefined, esNueva: boolean, ahora = new Date()) {
  if (!closesAt || !esNueva) return true;
  return closesAt.getTime() > ahora.getTime();
}

/**
 * Qué cambios admite una encuesta ya guardada. Sin votos, cualquiera. Con votos,
 * las opciones que existen no se tocan —cambiarles el texto o quitarlas
 * falsearía los resultados— y solo se pueden añadir otras nuevas.
 */
export function cambiosPermitidos(
  actuales: { id: string; label: string }[],
  nuevas: { id?: string; label: string }[],
  hayVotos: boolean,
): Resultado {
  const conocidas = new Map(actuales.map((opcion) => [opcion.id, opcion.label]));

  // Un id que no es de esta encuesta (formulario viejo o manipulado) no se
  // ignora: la opción se perdería sin que nadie se enterase.
  if (nuevas.some((opcion) => opcion.id !== undefined && !conocidas.has(opcion.id))) {
    return {
      ok: false,
      mensaje: "La encuesta ha cambiado. Recarga la página e inténtalo otra vez.",
    };
  }

  if (!hayVotos) return { ok: true };

  for (const actual of actuales) {
    const nueva = nuevas.find((opcion) => opcion.id === actual.id);
    if (!nueva) {
      return { ok: false, mensaje: "Con votos emitidos no se pueden quitar opciones." };
    }
    if (nueva.label.trim() !== actual.label) {
      return { ok: false, mensaje: "Con votos emitidos no se pueden cambiar las opciones." };
    }
  }

  return { ok: true };
}

/** Entero redondeado; con cero votos en total, 0 en lugar de `NaN`. */
export function porcentaje(votos: number, total: number) {
  return total === 0 ? 0 : Math.round((votos * 100) / total);
}

/**
 * Lo que manda el editor, sin validar todavía: `null` si el interruptor está
 * apagado. Los ids y los textos de las opciones llegan en dos listas paralelas.
 */
export function leerEncuestaDelFormulario(datos: FormData) {
  if (datos.get("pollEnabled") !== "on") return null;

  const ids = datos.getAll("pollOptionId").map(String);
  const textos = datos.getAll("pollOptionLabel").map(String);

  return {
    question: String(datos.get("pollQuestion") ?? ""),
    closesAt: String(datos.get("pollClosesAt") ?? ""),
    options: textos.map((label, indice) => ({ id: ids[indice] ?? "", label })),
  };
}
