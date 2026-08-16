"use client";

import { useMemo, useSyncExternalStore } from "react";
import { definicionDeVista, leerVistaBruta } from "@/lib/forms/vista-previa";
import { huellaDeCampos } from "@/lib/forms/esquema";
import { esPregunta, type FormDefinition } from "@/lib/forms";
import { CampoFormulario } from "@/components/ui/campo";
import { Boton } from "@/components/ui/button";

/** Nadie toca el borrador mientras esta pantalla está abierta. */
const noCambia = () => () => {};

/**
 * El formulario tal como lo verá quien lo rellene.
 *
 * Enseña lo que haya en el editor aunque no esté guardado —viaja por
 * `sessionStorage`—, y si no hay nada a medias, lo último guardado. En el
 * servidor sale siempre lo guardado: allí no hay manera de saber lo que hay
 * escrito en la otra pestaña, y pintar dos cosas distintas rompe la hidratación.
 */
export function VistaPreviaFormulario({ form }: { form: FormDefinition }) {
  const bruto = useSyncExternalStore(
    noCambia,
    () => leerVistaBruta(form.type),
    () => null,
  );

  const borrador = useMemo(
    () => definicionDeVista(bruto, form.type),
    [bruto, form.type],
  );

  const vista = borrador ?? form;
  // No basta con que haya algo en sessionStorage: el editor lo escribe en
  // cuanto se abre, aunque no se haya tocado nada. Solo es un borrador de
  // verdad si difiere de lo guardado — misma comparación que usa el editor
  // para su propio aviso de "sin guardar".
  const esBorrador =
    borrador !== null &&
    (borrador.title !== form.title ||
      borrador.summary !== form.summary ||
      huellaDeCampos(borrador.fields) !== huellaDeCampos(form.fields));

  return (
    <div className="grid gap-[var(--space-xl)] lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div className="grid gap-[var(--space-lg)]">
        <header className="grid max-w-[62ch] gap-[var(--space-sm)]">
          <span className="meta">Formulario</span>
          <h2 className="display text-(length:--text-display-s)">
            {vista.title || "Sin nombre"}
          </h2>
          <p className="text-[var(--color-muted)]">{vista.summary}</p>
        </header>

        {vista.fields.length === 0 ? (
          <p className="tile text-sm text-[var(--color-muted)]">
            No hay ninguna pregunta todavía, así que aquí no se vería nada.
          </p>
        ) : (
          <div className="grid gap-[var(--space-lg)]">
            {vista.fields.map((campo) => (
              <CampoFormulario
                key={campo.name}
                campo={{ ...campo, label: campo.label || "Sin enunciado" }}
              />
            ))}
          </div>
        )}

        {/* El botón está a la vista pero no hace nada: es media pantalla del
            formulario de verdad y sin él no se ve cómo termina. */}
        <div className="flex items-center gap-[var(--space-md)]">
          <Boton type="button" variante="primary" disabled>
            Enviar solicitud
          </Boton>
          <span className="meta">Aquí no envía nada</span>
        </div>
      </div>

      <aside className="tile grid gap-[var(--space-sm)] lg:sticky lg:top-24">
        <h3 className="display text-(length:--text-md)">
          {esBorrador ? "Sin guardar" : "Guardado"}
        </h3>
        <p className="text-sm text-[var(--color-muted)]">
          {esBorrador
            ? "Esto es lo que tienes escrito en el editor. Todavía no lo ve nadie: hay que guardarlo."
            : "Esto es lo que hay guardado ahora mismo, igual que lo ve quien va a postular."}
        </p>
        <span className="meta">{vista.fields.filter(esPregunta).length} preguntas</span>
      </aside>
    </div>
  );
}
