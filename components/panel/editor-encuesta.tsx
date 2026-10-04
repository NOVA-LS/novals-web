"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { MAX_ETIQUETA, MAX_OPCIONES, MAX_PREGUNTA, MIN_OPCIONES } from "@/lib/encuesta";
import { Boton } from "@/components/ui/button";

export type EncuestaGuardada = {
  question: string | null;
  /** ISO. Se convierte a hora local solo aquí, en el navegador. */
  closesAt: string | null;
  options: { id: string; label: string }[];
  votos: number;
};

type Fila = { clave: string; id: string; label: string };

/** Valor de un `datetime-local` en la hora del navegador. */
function aValorLocal(iso: string | null) {
  if (!iso) return "";
  const fecha = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

let contador = 0;
const claveNueva = () => `nueva-${++contador}`;

/**
 * Interruptor y opciones de la encuesta. Solo rellena campos del formulario del
 * editor (`pollEnabled`, `pollQuestion`, `pollClosesAt`, `pollOptionId`,
 * `pollOptionLabel`); la conversión de la fecha a ISO la hace el editor al
 * enviar. Con votos, las opciones que ya existen quedan de solo lectura (con
 * `readOnly`, no `disabled`, para que sigan enviándose): el servidor lo exige
 * igualmente.
 */
export function EditorEncuesta({
  encuesta,
  disabled,
}: {
  encuesta: EncuestaGuardada | null;
  disabled: boolean;
}) {
  const [activa, setActiva] = useState(encuesta !== null);
  const [filas, setFilas] = useState<Fila[]>(() =>
    encuesta
      ? encuesta.options.map((opcion) => ({ clave: opcion.id, id: opcion.id, label: opcion.label }))
      : [
          { clave: claveNueva(), id: "", label: "" },
          { clave: claveNueva(), id: "", label: "" },
        ],
  );
  const hayVotos = (encuesta?.votos ?? 0) > 0;

  function alternar(valor: boolean) {
    // Apagarla con votos los borra: se pide confirmar antes.
    if (
      !valor &&
      hayVotos &&
      !window.confirm(
        `Esta encuesta ya tiene ${encuesta?.votos} voto(s). Si la quitas, se pierden. ¿Quitarla?`,
      )
    ) {
      return;
    }
    setActiva(valor);
  }

  return (
    <div className="field">
      <label className="flex items-center gap-[var(--space-xs)] text-sm text-[var(--color-muted)]">
        <input
          type="checkbox"
          name="pollEnabled"
          checked={activa}
          onChange={(evento) => alternar(evento.target.checked)}
          disabled={disabled}
          className="size-4 accent-[var(--color-ink)]"
        />
        Añadir una encuesta al final de la noticia
      </label>

      {activa ? (
        <div className="tile grid gap-[var(--space-md)]">
          <div className="field">
            <label className="field__label" htmlFor="pollQuestion">
              Pregunta (opcional)
            </label>
            <input
              id="pollQuestion"
              name="pollQuestion"
              className="input"
              defaultValue={encuesta?.question ?? ""}
              maxLength={MAX_PREGUNTA}
              disabled={disabled}
            />
          </div>

          <div className="field">
            <span className="field__label">Opciones</span>
            <p className="field__help">
              De {MIN_OPCIONES} a {MAX_OPCIONES}.
              {hayVotos
                ? ` Ya tiene ${encuesta?.votos} voto(s): las opciones que existen no se pueden cambiar ni quitar, pero puedes añadir otras.`
                : ""}
            </p>

            <ul className="grid gap-[var(--space-xs)]">
              {filas.map((fila, indice) => {
                const bloqueada = hayVotos && fila.id !== "";
                return (
                  <li key={fila.clave} className="flex items-center gap-[var(--space-xs)]">
                    <input type="hidden" name="pollOptionId" value={fila.id} />
                    <input
                      name="pollOptionLabel"
                      className="input"
                      aria-label={`Opción ${indice + 1}`}
                      value={fila.label}
                      maxLength={MAX_ETIQUETA}
                      readOnly={bloqueada}
                      disabled={disabled}
                      onChange={(evento) =>
                        setFilas((previas) =>
                          previas.map((otra) =>
                            otra.clave === fila.clave
                              ? { ...otra, label: evento.target.value }
                              : otra,
                          ),
                        )
                      }
                    />
                    <Boton
                      type="button"
                      variante="ghost"
                      aria-label={`Quitar la opción ${indice + 1}`}
                      disabled={disabled || bloqueada || filas.length <= MIN_OPCIONES}
                      onClick={() =>
                        setFilas((previas) => previas.filter((otra) => otra.clave !== fila.clave))
                      }
                    >
                      <X size={15} aria-hidden />
                    </Boton>
                  </li>
                );
              })}
            </ul>

            <div>
              <Boton
                type="button"
                disabled={disabled || filas.length >= MAX_OPCIONES}
                onClick={() =>
                  setFilas((previas) => [...previas, { clave: claveNueva(), id: "", label: "" }])
                }
              >
                <Plus size={15} aria-hidden />
                Añadir opción
              </Boton>
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="pollClosesAt">
              Cierre (opcional)
            </label>
            <p className="field__help">
              Pasada esta fecha ya no se puede votar y solo se ven los resultados. Sin fecha, queda
              abierta mientras la noticia esté publicada.
            </p>
            <input
              id="pollClosesAt"
              name="pollClosesAt"
              type="datetime-local"
              className="input"
              defaultValue={aValorLocal(encuesta?.closesAt ?? null)}
              disabled={disabled}
              // El servidor y el navegador no tienen por qué compartir zona horaria.
              suppressHydrationWarning
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
