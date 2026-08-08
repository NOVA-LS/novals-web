import { definicionGuardada } from "./esquema";
import type { FormDefinition } from "./types";

/**
 * El puente entre el editor y la vista previa.
 *
 * La vista previa es otra pantalla, así que lo que hay escrito en el editor
 * —que vive en memoria y aún no se ha guardado— tiene que viajar de alguna
 * manera. Va por `sessionStorage`: es de esta pestaña y de este rato, que es
 * justo lo que dura un borrador a medio escribir.
 */

function clave(tipo: string) {
  return `nova:vista-formulario:${tipo}`;
}

export type BorradorVista = {
  title: string;
  summary: string;
  fields: FormDefinition["fields"];
};

export function guardarVistaBruta(tipo: string, texto: string) {
  try {
    sessionStorage.setItem(clave(tipo), texto);
  } catch {
    // Sin sitio o sin permiso: la vista previa enseñará lo último guardado.
  }
}

/**
 * El borrador tal cual está guardado, sin tocar.
 *
 * Devuelve el texto y no el objeto porque quien lo lee lo compara consigo mismo
 * para saber si cambió algo: dos objetos recién construidos nunca son iguales, y
 * dos textos idénticos sí.
 */
export function leerVistaBruta(tipo: string): string | null {
  try {
    return sessionStorage.getItem(clave(tipo));
  } catch {
    return null;
  }
}

/**
 * Lo que hubiera en el editor, si es que sigue valiendo. Devuelve null cuando no
 * hay nada o cuando lo hay no se sostiene; entonces se enseña lo ya guardado.
 */
export function definicionDeVista(
  bruto: string | null,
  tipo: string,
  version: number,
): FormDefinition | null {
  if (!bruto) return null;

  try {
    const borrador = JSON.parse(bruto) as BorradorVista;
    return definicionGuardada({ ...borrador, type: tipo, version });
  } catch {
    return null;
  }
}
