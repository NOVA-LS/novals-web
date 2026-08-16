import { z } from "zod";

type Base = {
  name: string;
  label: string;
  help?: string;
  required?: boolean;
};

export type Field =
  | (Base & {
      kind: "text";
      placeholder?: string;
      minLength?: number;
      maxLength?: number;
    })
  | (Base & {
      kind: "textarea";
      placeholder?: string;
      minLength?: number;
      maxLength?: number;
      rows?: number;
    })
  | (Base & { kind: "number"; min?: number; max?: number })
  | (Base & { kind: "date"; min?: string; max?: string })
  | (Base & {
      kind: "select";
      options: { value: string; label: string }[];
      /** Cuando es true, la respuesta es una lista de claves y no una sola. */
      multiple?: boolean;
      /**
       * Solo cuenta si `multiple` no está puesto: una múltiple ya se dibuja
       * como casillas siempre. Con una sola respuesta, decide si se ve como
       * desplegable (por defecto) o como una lista de casillas de una sola.
       */
      radios?: boolean;
    })
  | (Base & { kind: "checkbox" })
  /** Un archivo PDF. La respuesta guardada es su URL, no el fichero. */
  | (Base & { kind: "file" })
  /** Divisor con título: agrupa lo que sigue, no genera respuesta. */
  | (Base & { kind: "seccion" })
  /** Párrafo suelto sin pregunta asociada: label es un título opcional, help es el cuerpo. */
  | (Base & { kind: "texto" })
  /** Como "texto", pero se pinta como caja de aviso. */
  | (Base & { kind: "aviso" });

/**
 * No es una pregunta: no se valida, no genera respuesta y no cuenta como
 * pregunta en los contadores del panel y de las tarjetas.
 */
export function esPregunta(campo: Field): boolean {
  return campo.kind !== "seccion" && campo.kind !== "texto" && campo.kind !== "aviso";
}

export type FormDefinition = {
  /** Identificador estable, se guarda en Submission.type */
  type: string;
  title: string;
  summary: string;
  fields: Field[];
};

/**
 * Deriva el esquema Zod de las preguntas para que la validación de cliente,
 * la de servidor y el formulario dibujado no puedan desincronizarse.
 */
export function schemaFor(def: FormDefinition) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of def.fields) {
    // No son preguntas: no hay nada que validar.
    if (field.kind === "seccion" || field.kind === "texto" || field.kind === "aviso") {
      continue;
    }
    // El archivo lo resuelve quien construye las respuestas (hace falta
    // subirlo antes de saber su URL): aquí solo se valida la URL ya puesta.
    if (field.kind === "file") {
      const s = z.string().trim();
      shape[field.name] = (field.required ?? true)
        ? s.min(1, { message: "Sube un archivo." })
        : s.optional().or(z.literal(""));
      continue;
    }

    const required = field.required ?? true;

    switch (field.kind) {
      case "text":
      case "textarea": {
        let s = z.string().trim();
        if (field.minLength) {
          s = s.min(field.minLength, {
            message: `Mínimo ${field.minLength} caracteres.`,
          });
        }
        if (field.maxLength) {
          s = s.max(field.maxLength, {
            message: `Máximo ${field.maxLength} caracteres.`,
          });
        }
        shape[field.name] = required
          ? s.min(1, { message: "Este campo es obligatorio." })
          : s.optional().or(z.literal(""));
        break;
      }
      case "number": {
        let n = z.coerce.number({ message: "Introduce un número." }).int();
        if (field.min !== undefined) {
          n = n.min(field.min, { message: `El mínimo es ${field.min}.` });
        }
        if (field.max !== undefined) {
          n = n.max(field.max, { message: `El máximo es ${field.max}.` });
        }
        shape[field.name] = required ? n : n.optional();
        break;
      }
      case "date": {
        let d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Fecha no válida." });
        if (field.min !== undefined) {
          const min = field.min;
          d = d.refine((v) => v >= min, { message: `No puede ser antes del ${min}.` });
        }
        if (field.max !== undefined) {
          const max = field.max;
          d = d.refine((v) => v <= max, { message: `No puede ser después del ${max}.` });
        }
        shape[field.name] = required ? d : d.optional().or(z.literal(""));
        break;
      }
      case "select": {
        const values = field.options.map((option) => option.value);
        if (field.multiple) {
          const arr = z.array(
            z.enum(values as [string, ...string[]], { message: "Selecciona una opción." }),
          );
          shape[field.name] = required
            ? arr.min(1, { message: "Selecciona al menos una opción." })
            : arr.optional();
        } else {
          const s = z.enum(values as [string, ...string[]], {
            message: "Selecciona una opción.",
          });
          shape[field.name] = required ? s : s.optional();
        }
        break;
      }
      case "checkbox": {
        const b = z.coerce.boolean();
        shape[field.name] = required
          ? b.refine((value) => value === true, {
              message: "Debes marcar esta casilla.",
            })
          : b;
        break;
      }
    }
  }

  return z.object(shape);
}

/**
 * Convierte el FormData del navegador al objeto que espera el esquema.
 *
 * El archivo lo resuelve normalmente quien llama a esta función: hace falta
 * subirlo antes de tener su URL, así que por defecto un campo "file" se deja
 * fuera. La validación de cliente no sube nada —solo quiere saber si hay uno
 * elegido, para el aviso de obligatorio—, así que pasa `archivoElegido` y
 * recibe ese aviso sin tener que repetir el resto de esta función a mano.
 */
export function answersFromFormData(
  def: FormDefinition,
  data: FormData,
  opciones?: { archivoElegido?: (field: Extract<Field, { kind: "file" }>) => unknown },
) {
  const raw: Record<string, unknown> = {};
  for (const field of def.fields) {
    if (field.kind === "seccion" || field.kind === "texto" || field.kind === "aviso") {
      continue;
    }

    if (field.kind === "file") {
      if (opciones?.archivoElegido) raw[field.name] = opciones.archivoElegido(field);
      continue;
    }

    if (field.kind === "select" && field.multiple) {
      raw[field.name] = data.getAll(field.name);
      continue;
    }

    const value = data.get(field.name);
    raw[field.name] =
      field.kind === "checkbox" ? value === "on" || value === "true" : (value ?? "");
  }
  return raw;
}
