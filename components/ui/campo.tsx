"use client";

import type { Field } from "@/lib/forms";

/**
 * Dibuja una pregunta de un formulario declarativo.
 *
 * Lo usan las solicitudes y los tickets: los dos parten del mismo `Field`, así
 * que el dibujo tiene que ser el mismo o acabarían separándose sin querer.
 */
export function CampoFormulario({
  campo,
  error,
  deshabilitado = false,
}: {
  campo: Field;
  error?: string;
  deshabilitado?: boolean;
}) {
  const idError = `${campo.name}-error`;
  const idAyuda = `${campo.name}-ayuda`;
  const requerido = campo.required ?? true;

  const comunes = {
    id: campo.name,
    name: campo.name,
    className: "input",
    "aria-invalid": error ? true : undefined,
    "aria-describedby":
      [campo.help ? idAyuda : null, error ? idError : null]
        .filter(Boolean)
        .join(" ") || undefined,
    disabled: deshabilitado,
  } as const;

  return (
    <div className="field">
      {campo.kind === "checkbox" ? null : (
        <label className="field__label" htmlFor={campo.name}>
          {campo.label}
          {requerido ? null : (
            <span className="text-[var(--color-neutral)]"> · opcional</span>
          )}
        </label>
      )}

      {campo.help ? (
        <p id={idAyuda} className="field__help">
          {campo.help}
        </p>
      ) : null}

      {campo.kind === "textarea" ? (
        <textarea {...comunes} rows={campo.rows ?? 5} placeholder={campo.placeholder} />
      ) : campo.kind === "select" ? (
        <select {...comunes} defaultValue="">
          <option value="" disabled>
            Selecciona…
          </option>
          {campo.options.map((opcion) => (
            <option key={opcion.value} value={opcion.value}>
              {opcion.label}
            </option>
          ))}
        </select>
      ) : campo.kind === "checkbox" ? (
        <label className="flex items-start gap-[var(--space-xs)] text-sm text-[var(--color-muted)]">
          <input
            type="checkbox"
            id={campo.name}
            name={campo.name}
            disabled={deshabilitado}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? idError : undefined}
            className="mt-1 size-4 accent-[var(--color-ink)]"
          />
          <span>{campo.label}</span>
        </label>
      ) : campo.kind === "number" ? (
        <input {...comunes} type="number" min={campo.min} max={campo.max} inputMode="numeric" />
      ) : (
        <input {...comunes} type="text" placeholder={campo.placeholder} />
      )}

      {error ? (
        <p id={idError} className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
