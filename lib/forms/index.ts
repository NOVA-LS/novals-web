import type { FormDefinition } from "./types";

/**
 * Los formularios que vienen con la instalación: ahora mismo, ninguno.
 *
 * Se montan desde el panel y viven en la base (ver lib/forms/registro.ts). Esto
 * queda como puerta de atrás: un formulario escrito aquí no se puede borrar
 * desde la web y se puede devolver a su estado original de un botón, que es lo
 * que interesa para un trámite que no debería desaparecer por un descuido.
 *
 * Para añadir uno: crear su fichero exportando un FormDefinition y sumarlo aquí.
 */
export const FORMS: Record<string, FormDefinition> = {};

export const FORM_TYPES = Object.keys(FORMS);

export function getForm(type: string): FormDefinition | undefined {
  return FORMS[type];
}

export * from "./types";
