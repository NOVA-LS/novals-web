import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { ETIQUETA } from "@/lib/consultas";
import { FORMS, FORM_TYPES } from "./index";
import { definicionGuardada } from "./esquema";
import type { FormDefinition } from "./types";

/**
 * De dónde salen los formularios de verdad.
 *
 * Hay dos sitios: los ficheros de lib/forms, que son los de siempre y vienen con
 * la instalación, y la tabla FormConfig, donde cae lo que el panel edita. Manda
 * la tabla cuando tiene preguntas guardadas; si no, o si lo guardado no se
 * sostiene, manda el fichero. Así una fila corrupta deja la web con el
 * formulario original en vez de sin formulario.
 *
 * Todo lo que enseñe o valide un formulario tiene que pasar por aquí: leer FORMS
 * directamente devuelve el cuestionario de antes de la última edición.
 */

/** Techo de seguridad por si un `updateTag` se pierde. */
const UNA_HORA = 3600;

/** Los del código primero, en su orden; los creados en el panel, detrás. */
function orden(tipo: string, position: number) {
  const enCodigo = FORM_TYPES.indexOf(tipo);
  return [position, enCodigo === -1 ? FORM_TYPES.length : enCodigo] as const;
}

export const traerFormularios = unstable_cache(
  async (): Promise<FormDefinition[]> => {
    const filas = await db.formConfig.findMany({
      select: {
        type: true,
        title: true,
        summary: true,
        fields: true,
        position: true,
      },
    });

    const porTipo = new Map(filas.map((fila) => [fila.type, fila]));
    const lista: { def: FormDefinition; peso: readonly [number, number] }[] = [];

    for (const fila of filas) {
      const base = FORMS[fila.type];

      // Sin preguntas guardadas la fila es solo configuración: abrir, cerrar y
      // la espera. El cuestionario sigue siendo el del fichero.
      const guardada =
        fila.fields === null
          ? null
          : definicionGuardada({
              type: fila.type,
              title: fila.title ?? base?.title ?? fila.type,
              summary: fila.summary ?? base?.summary ?? "",
              fields: fila.fields,
            });

      const def = guardada ?? base;
      // Una fila sin preguntas y sin fichero detrás no es ningún formulario.
      if (def) lista.push({ def, peso: orden(fila.type, fila.position) });
    }

    // Y los que aún no tienen fila: recién instalado, nadie los ha tocado.
    for (const tipo of FORM_TYPES) {
      if (!porTipo.has(tipo)) {
        lista.push({ def: FORMS[tipo], peso: orden(tipo, 0) });
      }
    }

    lista.sort((a, b) => a.peso[0] - b.peso[0] || a.peso[1] - b.peso[1]);
    return lista.map((fila) => fila.def);
  },
  ["formularios-definiciones"],
  { tags: [ETIQUETA.formularios], revalidate: UNA_HORA },
);

export async function traerForm(tipo: string): Promise<FormDefinition | undefined> {
  const formularios = await traerFormularios();
  return formularios.find((form) => form.type === tipo);
}

/** Los títulos por tipo, para las listas que enseñan solicitudes de varios. */
export async function traerTitulos(): Promise<Map<string, string>> {
  const formularios = await traerFormularios();
  return new Map(formularios.map((form) => [form.type, form.title]));
}
