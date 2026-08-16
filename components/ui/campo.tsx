"use client";

import { TriangleAlert } from "lucide-react";
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

  if (campo.kind === "seccion") {
    return (
      <div className="grid gap-[var(--space-2xs)] border-t border-[var(--color-rule)] pt-[var(--space-md)] first:border-t-0 first:pt-0">
        <h3 className="display text-(length:--text-md)">{campo.label}</h3>
        {campo.help ? <p className="text-sm whitespace-pre-wrap text-[var(--color-muted)]">{campo.help}</p> : null}
      </div>
    );
  }

  if (campo.kind === "texto") {
    return (
      <div className="grid gap-[var(--space-2xs)]">
        {campo.label ? <p className="field__label">{campo.label}</p> : null}
        {campo.help ? <p className="text-sm whitespace-pre-wrap text-[var(--color-muted)]">{campo.help}</p> : null}
      </div>
    );
  }

  if (campo.kind === "aviso") {
    return (
      <div className="grid gap-[var(--space-2xs)] rounded-[var(--radius-sm)] border-s-2 border-[var(--color-pending)] bg-[color-mix(in_oklch,var(--color-pending)_12%,var(--color-paper-2))] px-[var(--space-md)] py-[var(--space-sm)]">
        <div className="flex items-center gap-[var(--space-2xs)] text-[var(--color-pending)]">
          <TriangleAlert size={16} aria-hidden />
          {campo.label ? <span className="text-sm font-medium">{campo.label}</span> : null}
        </div>
        {campo.help ? <p className="text-sm whitespace-pre-wrap text-[var(--color-ink)]">{campo.help}</p> : null}
      </div>
    );
  }

  // Una casilla o un grupo de radios no es una sola pregunta con un solo id
  // al que apuntar: es varias, así que va en un fieldset/legend en vez de un
  // label con htmlFor apuntando a un id que no existe.
  if (campo.kind === "select" && (campo.multiple || campo.radios)) {
    return (
      <fieldset
        className="field"
        aria-describedby={comunes["aria-describedby"]}
        aria-invalid={error ? true : undefined}
      >
        <legend className="field__label">
          {campo.label}
          {requerido ? null : (
            <span className="text-[var(--color-neutral)]"> · opcional</span>
          )}
        </legend>

        {campo.help ? (
          <p id={idAyuda} className="field__help">
            {campo.help}
          </p>
        ) : null}

        <div className="grid gap-[var(--space-2xs)]">
          {campo.options.map((opcion) => (
            <label
              key={opcion.value}
              className="flex items-center gap-[var(--space-xs)] text-sm text-[var(--color-muted)]"
            >
              <input
                type={campo.multiple ? "checkbox" : "radio"}
                name={campo.name}
                value={opcion.value}
                disabled={deshabilitado}
                className="size-4 accent-[var(--color-ink)]"
              />
              {opcion.label}
            </label>
          ))}
        </div>

        {error ? (
          <p id={idError} className="field__error" role="alert">
            {error}
          </p>
        ) : null}
      </fieldset>
    );
  }

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
            aria-describedby={comunes["aria-describedby"]}
            className="mt-1 size-4 accent-[var(--color-ink)]"
          />
          <span>{campo.label}</span>
        </label>
      ) : campo.kind === "number" ? (
        <input {...comunes} type="number" min={campo.min} max={campo.max} inputMode="numeric" />
      ) : campo.kind === "date" ? (
        <input {...comunes} type="date" min={campo.min} max={campo.max} />
      ) : campo.kind === "file" ? (
        <input {...comunes} type="file" accept="application/pdf" />
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
