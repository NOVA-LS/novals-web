"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { valorarTicket } from "@/lib/actions/tickets";
import { Boton } from "@/components/ui/button";

/**
 * La nota que le pone el autor a la atención recibida.
 *
 * Sale solo con el ticket cerrado y solo a quien lo abrió. Se manda una vez y ya
 * no se toca: una nota que se puede rehacer deja de decir cómo fue la atención y
 * pasa a decir qué opina hoy quien la puso. Después queda a la vista, para que
 * al menos se sepa qué se mandó.
 */

const NOTAS = [0, 1, 2, 3, 4, 5];

/** Qué significa cada número, para no dejarlo a interpretación. */
const TEXTO: Record<number, string> = {
  0: "Muy mal",
  1: "Mal",
  2: "Regular",
  3: "Bien",
  4: "Muy bien",
  5: "Inmejorable",
};

export function ValorarTicket({
  id,
  valoracion,
  nota,
}: {
  id: string;
  /** Lo que ya puso, si es que puso algo. Con nota, esto es de solo leer. */
  valoracion: number | null;
  nota: string | null;
}) {
  const router = useRouter();
  const [elegida, setElegida] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();

  // Lo recién mandado se enseña sin esperar al servidor; lo que ya venía
  // guardado llega por las propiedades.
  const [reciente, setReciente] = useState<{
    valoracion: number;
    nota: string | null;
  } | null>(null);

  const puesta = reciente ?? (valoracion === null ? null : { valoracion, nota });

  function enviar() {
    if (elegida === null) return;
    setError(null);

    empezar(async () => {
      const resultado = await valorarTicket(id, elegida, texto);
      if (resultado.ok) {
        setReciente({ valoracion: elegida, nota: texto.trim() || null });
        router.refresh();
      } else {
        setError(resultado.mensaje);
      }
    });
  }

  if (puesta) {
    return (
      <section id="valoracion" className="tile grid gap-[var(--space-sm)]">
        <div className="grid gap-[var(--space-2xs)]">
          <span className="meta">Tu valoración</span>
          <span className="display text-(length:--text-md)">
            {puesta.valoracion}/5 · {TEXTO[puesta.valoracion]}
          </span>
        </div>

        {puesta.nota ? (
          <p className="respuesta text-sm text-[var(--color-muted)]">{puesta.nota}</p>
        ) : null}

        <span className="meta">Ya está enviada: no se puede cambiar.</span>
      </section>
    );
  }

  return (
    <section id="valoracion" className="tile grid gap-[var(--space-md)]">
      <div className="grid gap-[var(--space-2xs)]">
        <h2 className="display text-(length:--text-md)">
          ¿Qué tal te atendieron?
        </h2>
        <p className="text-sm text-[var(--color-muted)]">
          Del 0 al 5. Lo lee el staff y no cambia nada de lo ya resuelto: sirve
          para saber cómo se está atendiendo.
        </p>
      </div>

      <div>
        <div className="puntuacion" role="group" aria-label="Nota del 0 al 5">
          {NOTAS.map((numero) => (
            <button
              key={numero}
              type="button"
              className="puntuacion__boton"
              aria-pressed={elegida === numero}
              aria-label={`${numero} · ${TEXTO[numero]}`}
              disabled={enviando}
              onClick={() => {
                setElegida(numero);
                setError(null);
              }}
            >
              {numero}
            </button>
          ))}
        </div>

        {/* El significado del número elegido, debajo: seis etiquetas a la vez
            no caben, y sin ninguna un 3 no se sabe si es bueno o malo. */}
        <p className="meta pt-[var(--space-xs)]">
          {elegida === null ? "Elige una nota" : TEXTO[elegida]}
        </p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="valoracion-nota">
          Si quieres, cuenta por qué
        </label>
        <textarea
          id="valoracion-nota"
          className="input"
          rows={3}
          maxLength={500}
          value={texto}
          disabled={enviando}
          placeholder="Opcional"
          onChange={(evento) => setTexto(evento.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-[var(--space-md)]">
        <Boton
          type="button"
          variante="primary"
          onClick={enviar}
          disabled={enviando || elegida === null}
          data-state={enviando ? "loading" : undefined}
        >
          {enviando ? "Enviando…" : "Valorar"}
        </Boton>

        {/* Se dice antes de pulsar, no después: es la única vez que se manda. */}
        <span className="meta">Solo se envía una vez</span>

        {error ? (
          <span className="field__error" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </section>
  );
}
