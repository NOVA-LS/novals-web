"use client";

import { useState, useTransition } from "react";
import { cambiarPublicacion } from "@/lib/actions/posts";
import { Boton } from "@/components/ui/button";

/**
 * Publicar o despublicar desde la lista. Si la noticia ya se avisó alguna vez y
 * va a volver a publicarse, antes de nada se dice cuándo fue y se deja elegir
 * entre avisar otra vez o publicar sin avisar. El servidor decide con la misma
 * regla (`debeAvisar`): esto solo recoge la elección.
 */
export function PublicarNoticia({
  id,
  publicada,
  avisadaEn,
  hayAviso,
}: {
  id: string;
  publicada: boolean;
  /** Cuándo se avisó la última vez, ya formateado; nulo si nunca se avisó. */
  avisadaEn: string | null;
  /** Tiene canal o privado marcado: sin ninguno no hay nada que avisar. */
  hayAviso: boolean;
}) {
  const [preguntando, setPreguntando] = useState(false);
  const [enCurso, empezar] = useTransition();

  function cambiar(reavisar: boolean) {
    empezar(async () => {
      await cambiarPublicacion(id, !publicada, reavisar);
      setPreguntando(false);
    });
  }

  if (!publicada && avisadaEn && hayAviso && preguntando) {
    return (
      <div
        className="flex flex-wrap items-center gap-[var(--space-xs)]"
        role="alertdialog"
        aria-label="Esta noticia ya se avisó"
      >
        <span className="text-sm text-[var(--color-muted)]">
          Ya se avisó el {avisadaEn} (canal y/o privados). ¿Quieres avisar otra vez?
        </span>
        <Boton type="button" variante="primary" disabled={enCurso} onClick={() => cambiar(true)}>
          Publicar y avisar
        </Boton>
        <Boton type="button" disabled={enCurso} onClick={() => cambiar(false)}>
          Publicar sin avisar
        </Boton>
        <Boton
          type="button"
          variante="ghost"
          disabled={enCurso}
          onClick={() => setPreguntando(false)}
        >
          Cancelar
        </Boton>
      </div>
    );
  }

  return (
    <Boton
      type="button"
      disabled={enCurso}
      onClick={() =>
        !publicada && avisadaEn && hayAviso ? setPreguntando(true) : cambiar(false)
      }
    >
      {publicada ? "Despublicar" : "Publicar"}
    </Boton>
  );
}
