import { formatearFecha } from "@/lib/utils";
import type { Field } from "./types";

/**
 * Una respuesta guardada, pasada a texto legible.
 *
 * La usan el panel de solicitudes y el resumen de un ticket: los dos pintan
 * las mismas respuestas y antes lo hacían cada uno a su manera, con el riesgo
 * de que un tipo de pregunta se leyera distinto en cada sitio.
 */
export function textoDeRespuesta(campo: Field, valor: unknown): string {
  if (campo.kind === "checkbox") return valor ? "Sí" : "No";

  if (campo.kind === "select") {
    const claves = Array.isArray(valor) ? valor : valor ? [valor] : [];
    return claves
      .map(
        (clave) =>
          campo.options.find((opcion) => opcion.value === clave)?.label ?? String(clave),
      )
      .join(", ");
  }

  if (campo.kind === "date") {
    return valor ? formatearFecha(String(valor)) : "";
  }

  return String(valor ?? "");
}
