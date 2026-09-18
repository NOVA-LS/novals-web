"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolverSolicitud } from "@/lib/actions/submissions";
import { Boton } from "@/components/ui/button";

type Accion = "IN_REVIEW" | "ACCEPTED" | "REJECTED";

export function ResolverForm({
  id,
  notaInicial,
}: {
  id: string;
  notaInicial: string;
}) {
  const router = useRouter();
  const [nota, setNota] = useState(notaInicial);
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enCurso, setEnCurso] = useState<Accion | null>(null);

  function resolver(estado: Accion) {
    if (estado === "REJECTED" && nota.trim().length < 10) {
      setError("Escribe el motivo del rechazo: lo va a leer el solicitante.");
      return;
    }

    setError(null);
    setEnCurso(estado);
    empezar(async () => {
      try {
        await resolverSolicitud(id, estado, nota);
        router.refresh();
      } catch {
        setError("No se pudo guardar. Recarga y vuelve a intentarlo.");
      } finally {
        setEnCurso(null);
      }
    });
  }

  return (
    <div className="grid gap-[var(--space-sm)]">
      <div className="field">
        <label className="field__label" htmlFor="nota">
          Nota para el solicitante
        </label>
        <p className="field__help">
          Se muestra en su página de solicitudes. Obligatoria al rechazar.
        </p>
        <textarea
          id="nota"
          className="input"
          rows={4}
          value={nota}
          disabled={pendiente}
          onChange={(evento) => setNota(evento.target.value)}
        />
      </div>

      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-[var(--space-xs)]">
        <Boton
          type="button"
          onClick={() => resolver("IN_REVIEW")}
          disabled={pendiente}
          data-state={enCurso === "IN_REVIEW" ? "loading" : undefined}
        >
          Marcar en revisión
        </Boton>
        <Boton
          type="button"
          variante="primary"
          onClick={() => resolver("ACCEPTED")}
          disabled={pendiente}
          data-state={enCurso === "ACCEPTED" ? "loading" : undefined}
        >
          Aceptar
        </Boton>
        <Boton
          type="button"
          onClick={() => resolver("REJECTED")}
          disabled={pendiente}
          data-state={enCurso === "REJECTED" ? "loading" : "error"}
        >
          Rechazar
        </Boton>
      </div>
    </div>
  );
}
