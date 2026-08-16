import { z } from "zod";
import { slugify } from "@/lib/utils";
import type { Field, FormDefinition } from "./types";

/**
 * La forma de un formulario, comprobada.
 *
 * Mientras las preguntas vivían en el código bastaba con el tipo de TypeScript:
 * no había manera de escribir una mal. Ahora se editan desde el panel y se
 * guardan como JSON, así que hace falta comprobarlas dos veces: al guardarlas,
 * para no aceptar un disparate, y al leerlas, porque una fila vieja o tocada a
 * mano no es de fiar y no puede tirar abajo la página de postular.
 */

/** Clave de una pregunta o de una opción: es lo que se guarda en la respuesta. */
const CLAVE = /^[a-z][a-z0-9_]*$/;

const clave = z
  .string()
  .regex(CLAVE, "Empieza por una letra y usa solo minúsculas, números y _.")
  .max(40);

// Sin tope de caracteres: lo escribe quien monta el formulario —admin, no
// público— y no hay motivo para ponerle un límite a su propio texto.
const etiqueta = z.string().trim().min(1, "Ponle un enunciado.");
/** Para texto informativo y aviso: son un título, no una pregunta, y puede no llevar. */
const etiquetaLibre = z.string().trim();
const ayuda = z.string().trim().optional();
const entero = z.number().int().min(0).max(100000);

const base = {
  name: clave,
  label: etiqueta,
  help: ayuda,
  required: z.boolean().optional(),
};

const opcion = z.object({
  value: clave,
  label: z.string().trim().min(1, "La opción necesita texto."),
});

/** Que el mínimo no se pase del máximo; si no, no habría respuesta válida. */
function ordenados(
  campo: { min?: number | string; max?: number | string },
  ctx: z.RefinementCtx,
) {
  if (campo.min !== undefined && campo.max !== undefined && campo.min > campo.max) {
    ctx.addIssue({ code: "custom", message: "El mínimo supera al máximo." });
  }
}

export const esquemaCampo = z
  .discriminatedUnion("kind", [
    z.object({
      ...base,
      kind: z.literal("text"),
      placeholder: z.string().trim().optional(),
      minLength: entero.optional(),
      maxLength: entero.optional(),
    }),
    z.object({
      ...base,
      kind: z.literal("textarea"),
      placeholder: z.string().trim().optional(),
      minLength: entero.optional(),
      maxLength: entero.optional(),
      rows: z.number().int().min(2).max(30).optional(),
    }),
    z.object({
      ...base,
      kind: z.literal("number"),
      min: z.number().int().optional(),
      max: z.number().int().optional(),
    }),
    z.object({
      ...base,
      kind: z.literal("date"),
      min: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida.")
        .optional(),
      max: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida.")
        .optional(),
    }),
    z.object({
      ...base,
      kind: z.literal("select"),
      multiple: z.boolean().optional(),
      radios: z.boolean().optional(),
      options: z
        .array(opcion)
        .min(1, "Una lista de opciones necesita al menos una.")
        .max(30)
        .superRefine((opciones, ctx) => {
          const vistas = new Set<string>();
          for (const opcion of opciones) {
            if (vistas.has(opcion.value)) {
              ctx.addIssue({
                code: "custom",
                message: `La opción «${opcion.value}» está repetida.`,
              });
            }
            vistas.add(opcion.value);
          }
        }),
    }),
    z.object({ ...base, kind: z.literal("checkbox") }),
    z.object({ ...base, kind: z.literal("file") }),
    z.object({ ...base, kind: z.literal("seccion") }),
    z.object({ ...base, kind: z.literal("texto"), label: etiquetaLibre }),
    z.object({ ...base, kind: z.literal("aviso"), label: etiquetaLibre }),
  ])
  .superRefine((campo, ctx) => {
    if (campo.kind === "text" || campo.kind === "textarea") {
      ordenados({ min: campo.minLength, max: campo.maxLength }, ctx);
    }
    if (campo.kind === "number") ordenados(campo, ctx);
    if (campo.kind === "date") ordenados(campo, ctx);
  });

export const esquemaDefinicion = z.object({
  type: clave,
  title: z.string().trim().min(1, "El formulario necesita un nombre."),
  summary: z.string().trim().min(1, "Explica de qué va en una línea."),
  fields: z
    .array(esquemaCampo)
    .max(60, "Sesenta preguntas son demasiadas.")
    .superRefine((campos, ctx) => {
      const vistos = new Set<string>();
      for (const campo of campos) {
        if (vistos.has(campo.name)) {
          ctx.addIssue({
            code: "custom",
            message: `Hay dos preguntas con la clave «${campo.name}».`,
          });
        }
        vistos.add(campo.name);
      }
    }),
});

/**
 * Lo que se puede tocar desde el panel. El tipo no entra: no se cambia nunca
 * porque es con lo que están guardadas las solicitudes.
 */
export const esquemaBorrador = esquemaDefinicion.omit({
  type: true,
});

export type BorradorFormulario = z.infer<typeof esquemaBorrador>;

/**
 * La clave de una pregunta o de una opción, sacada de su texto.
 *
 * Vive aquí, junto al esquema que la valida, porque la usan los dos lados: el
 * editor al escribir el enunciado y el servidor al crear un formulario. Si cada
 * uno la calculara a su manera, el panel enseñaría una clave y se guardaría otra.
 */
export function claveDeCampo(
  texto: string,
  ocupadas: Iterable<string>,
  /** De dónde tirar cuando el texto no da ninguna letra: «¿?» no es una clave. */
  respaldo = "pregunta",
) {
  const base = slugify(texto).replace(/-/g, "_").slice(0, 36) || respaldo;
  // Una clave no puede empezar por número: es lo que exige el esquema.
  const limpia = /^[a-z]/.test(base) ? base : `p_${base}`;

  const tomadas = new Set(ocupadas);
  let candidata = limpia;
  let intento = 1;
  while (tomadas.has(candidata)) candidata = `${limpia}_${++intento}`;

  return candidata;
}

/**
 * Las preguntas reducidas a un texto comparable.
 *
 * Sirve para saber si una edición cambió el cuestionario o solo el nombre del
 * formulario. Se ordenan las claves porque el mismo campo escrito por el
 * editor y leído del fichero trae sus propiedades en otro orden, y eso no es
 * un cambio.
 */
export function huellaDeCampos(campos: Field[]): string {
  return JSON.stringify(campos, (_clave, valor) =>
    valor && typeof valor === "object" && !Array.isArray(valor)
      ? Object.fromEntries(
          Object.entries(valor as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        )
      : valor,
  );
}

/**
 * Huella del formulario entero —título, resumen y preguntas—, para saber si lo
 * que hay en el editor sigue siendo lo último guardado.
 *
 * Sirve para detectar que dos admins han editado el mismo formulario a la vez:
 * quien guarda segundo compara su huella de partida contra la que hay ahora en
 * la base, y si no coinciden es que alguien más guardó por medio.
 */
export function huellaFormulario(def: { title: string; summary: string; fields: Field[] }): string {
  return JSON.stringify({ title: def.title, summary: def.summary, campos: huellaDeCampos(def.fields) });
}

/** Primer error legible de un intento fallido, con la pregunta a la que va. */
export function primerFallo(error: z.ZodError, campos?: Field[]): string {
  const fallo = error.issues[0];
  if (!fallo) return "Hay algo mal en el formulario.";

  // El camino es ["fields", 3, "label"]: con el índice se puede decir en cuál.
  const [raiz, indice] = fallo.path;
  if (raiz === "fields" && typeof indice === "number") {
    const campo = campos?.[indice];
    const nombre = campo?.label?.trim() || `pregunta ${indice + 1}`;
    return `${nombre}: ${fallo.message}`;
  }

  return fallo.message;
}

/**
 * Lee una definición guardada. Devuelve null si no se sostiene: quien llame
 * decide entonces con qué se queda, que siempre es la del fichero.
 */
export function definicionGuardada(valor: unknown): FormDefinition | null {
  const parsed = esquemaDefinicion.safeParse(valor);
  return parsed.success ? (parsed.data as FormDefinition) : null;
}
