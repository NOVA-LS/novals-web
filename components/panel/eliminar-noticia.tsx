"use client";

import { useState, useTransition } from "react";
import { eliminarNoticia } from "@/lib/actions/posts";
import { Boton } from "@/components/ui/button";

/**
 * Dos pasos en la propia fila: el primer clic no borra, pide confirmar. La
 * acción vuelve a comprobar el rol en el servidor; esto solo evita el clic
 * por descuido.
 */
export function EliminarNoticia({ id, titulo }: { id: string; titulo: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrando, empezar] = useTransition();

  function confirmar() {
    setError(null);
    empezar(async () => {
      const resultado = await eliminarNoticia(id);
      if (!resultado.ok) {
        setError(resultado.mensaje ?? "No se pudo eliminar.");
        setConfirmando(false);
      }
    });
  }

  if (!confirmando) {
    return (
      <div className="grid gap-[var(--space-2xs)]">
        <Boton type="button" variante="danger" onClick={() => setConfirmando(true)}>
          Eliminar
        </Boton>
        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-[var(--space-xs)]"
      role="alertdialog"
      aria-label={`Confirmar la eliminación de ${titulo}`}
    >
      <span className="text-sm text-[var(--color-muted)]">
        ¿Eliminar «{titulo}»? Se borran también su encuesta y sus apoyos.
      </span>
      <Boton type="button" variante="danger" disabled={borrando} onClick={confirmar}>
        {borrando ? "Eliminando…" : "Sí, eliminar"}
      </Boton>
      <Boton
        type="button"
        variante="ghost"
        disabled={borrando}
        onClick={() => setConfirmando(false)}
      >
        Cancelar
      </Boton>
    </div>
  );
}
