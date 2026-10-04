"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { alternarApoyo } from "@/lib/actions/interaccion";
import { Boton, EnlaceBoton } from "@/components/ui/button";

/** Siempre visible. Sin sesión, pulsarlo lleva a entrar; con sesión pone o quita el apoyo. */
export function BotonApoyo({
  postId,
  apoyos,
  apoyado,
  logueado,
  hrefEntrar,
}: {
  postId: string;
  apoyos: number;
  apoyado: boolean;
  logueado: boolean;
  hrefEntrar: string;
}) {
  const [activo, setActivo] = useOptimistic(apoyado);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();

  // El contador que llega ya cuenta el apoyo propio, si lo hay.
  const cuenta = apoyos - (apoyado ? 1 : 0) + (activo ? 1 : 0);

  function alternar() {
    setError(null);
    empezar(async () => {
      setActivo(!activo);
      const resultado = await alternarApoyo(postId);
      if (!resultado.ok) setError(resultado.mensaje ?? "No se pudo apoyar.");
    });
  }

  const contenido = (
    <>
      <Heart size={15} aria-hidden fill={activo ? "currentColor" : "none"} />
      Apoyar · {cuenta}
    </>
  );

  return (
    <div className="grid justify-items-start gap-[var(--space-2xs)]">
      {logueado ? (
        <Boton type="button" className="btn--pill" aria-pressed={activo} onClick={alternar}>
          {contenido}
        </Boton>
      ) : (
        <EnlaceBoton href={hrefEntrar} className="btn--pill">
          {contenido}
        </EnlaceBoton>
      )}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
