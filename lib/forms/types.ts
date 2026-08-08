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
  | (Base & { kind: "select"; options: { value: string; label: string }[] })
  | (Base & { kind: "checkbox" });

export type FormDefinition = {
  /** Identificador estable, se guarda en Submission.type */
  type: string;
  title: string;
  summary: string;
  /** Súbela al cambiar las preguntas: las respuestas antiguas conservan la suya */
  version: number;
  fields: Field[];
};

/**
 * Deriva el esquema Zod de las preguntas para que la validación de cliente,
 * la de servidor y el formulario dibujado no puedan desincronizarse.
 */
export function schemaFor(def: FormDefinition) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of def.fields) {
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
      case "select": {
        const values = field.options.map((option) => option.value);
        const s = z.enum(values as [string, ...string[]], {
          message: "Selecciona una opción.",
        });
        shape[field.name] = required ? s : s.optional();
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

/** Convierte el FormData del navegador al objeto que espera el esquema. */
export function answersFromFormData(def: FormDefinition, data: FormData) {
  const raw: Record<string, unknown> = {};
  for (const field of def.fields) {
    const value = data.get(field.name);
    raw[field.name] =
      field.kind === "checkbox" ? value === "on" || value === "true" : (value ?? "");
  }
  return raw;
}
