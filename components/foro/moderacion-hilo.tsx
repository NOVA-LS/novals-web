"use client";

import { useState, useTransition } from "react";
import { Lock, LockOpen, Pin, PinOff, Trash2 } from "lucide-react";
import { borrarHilo, moderarHilo } from "@/lib/actions/foro";
import { Boton } from "@/components/ui/button";

export function ModeracionHilo({
  id,
  pinned,
  locked,
  puedeModerar,
  puedeBorrar,
}: {
  id: string;
  pinned: boolean;
  locked: boolean;
  puedeModerar: boolean;
  puedeBorrar: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  if (!puedeModerar && !puedeBorrar) return null;

  return (
    <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
      {puedeModerar ? (
        <>
          <Boton
            type="button"
            disabled={ocupado}
            onClick={() =>
              empezar(async () => {
                const resultado = await moderarHilo(id, { pinned: !pinned });
                if (!resultado.ok) setError(resultado.mensaje ?? "No se pudo.");
              })
            }
          >
            {pinned ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />}
            {pinned ? "Dejar de fijar" : "Fijar"}
          </Boton>

          <Boton
            type="button"
            disabled={ocupado}
            onClick={() =>
              empezar(async () => {
                const resultado = await moderarHilo(id, { locked: !locked });
                if (!resultado.ok) setError(resultado.mensaje ?? "No se pudo.");
              })
            }
          >
            {locked ? <LockOpen size={15} aria-hidden /> : <Lock size={15} aria-hidden />}
            {locked ? "Reabrir" : "Cerrar"}
          </Boton>
        </>
      ) : null}

      {puedeBorrar ? (
        <Boton
          type="button"
          variante="danger"
          disabled={ocupado}
          onClick={() => {
            if (!confirm("¿Borrar el hilo entero, con sus respuestas?")) return;
            empezar(async () => {
              const resultado = await borrarHilo(id);
              if (resultado && !resultado.ok) {
                setError(resultado.mensaje ?? "No se pudo borrar.");
              }
            });
          }}
        >
          <Trash2 size={15} aria-hidden />
          Borrar hilo
        </Boton>
      ) : null}

      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
