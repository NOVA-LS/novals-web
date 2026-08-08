"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { responderTicket } from "@/lib/actions/tickets";
import { MAX_ADJUNTOS } from "@/lib/limites";
import { Boton } from "@/components/ui/button";

/**
 * Caja de respuesta de un ticket.
 *
 * La misma para el jugador y para el staff; lo único que cambia es la casilla de
 * nota interna, que solo se le pasa a quien puede escribirlas.
 */
export function ResponderTicket({
  id,
  puedeNotaInterna = false,
}: {
  id: string;
  puedeNotaInterna?: boolean;
}) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();

  function onSubmit(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setAviso(null);

    const datos = new FormData(evento.currentTarget);

    empezar(async () => {
      const resultado = await responderTicket(id, datos);
      if (resultado.ok) {
        formulario.current?.reset();
        router.refresh();
      } else {
        setAviso(resultado.mensaje);
      }
    });
  }

  return (
    <form
      ref={formulario}
      onSubmit={onSubmit}
      className="tile grid gap-[var(--space-sm)]"
    >
      <label className="field__label" htmlFor="mensaje">
        Tu mensaje
      </label>
      <textarea
        id="mensaje"
        name="mensaje"
        rows={5}
        className="input"
        placeholder="Escribe aquí…"
        disabled={enviando}
        required
      />

      <div className="grid gap-[var(--space-xs)] sm:flex sm:items-center sm:justify-between">
        <input
          name="adjuntos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={enviando}
          className="input input--archivo"
          aria-label={`Adjuntar imágenes, hasta ${MAX_ADJUNTOS}`}
        />

        <div className="flex items-center gap-[var(--space-md)]">
          {puedeNotaInterna ? (
            <label className="flex items-center gap-[var(--space-xs)] text-sm text-[var(--color-muted)]">
              <input
                type="checkbox"
                name="interno"
                disabled={enviando}
                className="size-4 accent-[var(--color-ink)]"
              />
              Nota interna
            </label>
          ) : null}

          <Boton type="submit" variante="primary" disabled={enviando}>
            {enviando ? "Enviando…" : "Responder"}
          </Boton>
        </div>
      </div>

      {aviso ? (
        <p className="field__error" role="alert">
          {aviso}
        </p>
      ) : null}
    </form>
  );
}
