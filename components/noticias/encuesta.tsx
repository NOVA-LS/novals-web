"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { votarEncuesta } from "@/lib/actions/interaccion";
import { porcentaje } from "@/lib/encuesta";
import type { EstadoEncuesta } from "@/lib/interaccion";

/**
 * Los resultados se ven siempre. Sin sesión, pulsar una opción lleva a entrar;
 * con sesión se vota, se cambia o se retira el voto con el mismo clic. El servidor decide si se acepta: `abierta` solo pinta.
 */
export function Encuesta({
  encuesta,
  logueado,
  hrefEntrar,
}: {
  encuesta: EstadoEncuesta;
  logueado: boolean;
  hrefEntrar: string;
}) {
  const [voto, setVoto] = useOptimistic(encuesta.miVoto);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  const router = useRouter();

  // Los votos que llegan ya incluyen el propio: se descuenta y se vuelve a
  // sumar según lo que esté marcado ahora (lo optimista o lo confirmado).
  const votosDe = (id: string, votos: number) =>
    votos - (encuesta.miVoto === id ? 1 : 0) + (voto === id ? 1 : 0);
  const total = encuesta.opciones.reduce(
    (suma, opcion) => suma + votosDe(opcion.id, opcion.votos),
    0,
  );

  function votar(id: string) {
    if (!logueado) {
      router.push(hrefEntrar);
      return;
    }

    const nuevo = voto === id ? null : id;
    setError(null);

    empezar(async () => {
      setVoto(nuevo);
      const resultado = await votarEncuesta(encuesta.id, nuevo);
      if (!resultado.ok) setError(resultado.mensaje ?? "No se pudo votar.");
    });
  }

  return (
    <section className="encuesta" aria-label="Encuesta">
      <div className="flex flex-wrap items-center gap-x-[var(--space-sm)]">
        {encuesta.question ? (
          <h2 className="display text-(length:--text-md)">{encuesta.question}</h2>
        ) : null}
        <span className="meta">{total} voto(s)</span>
      </div>

      <ul className="grid gap-[var(--space-xs)]">
        {encuesta.opciones.map((opcion) => {
          const votos = votosDe(opcion.id, opcion.votos);
          const pct = porcentaje(votos, total);
          const contenido = (
            <>
              <span>{opcion.label}</span>
              <span className="meta">{pct}%</span>
            </>
          );

          return (
            <li key={opcion.id}>
              <button
                type="button"
                className="encuesta__opcion"
                aria-pressed={voto === opcion.id}
                disabled={!encuesta.abierta}
                onClick={() => votar(opcion.id)}
                style={{ "--porcentaje": `${pct}%` } as React.CSSProperties}
              >
                <span className="encuesta__barra" aria-hidden />
                <span className="encuesta__contenido">{contenido}</span>
                {/* Mismo texto en oscuro, recortado al ancho de la barra: así se lee
                    sobre el relleno blanco y sobre el fondo, sin partir las letras. */}
                <span className="encuesta__contenido encuesta__contenido--sobre-barra" aria-hidden>
                  {contenido}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {encuesta.cierraEl ? (
        <p className="meta">{encuesta.abierta ? `Cierra el ${encuesta.cierraEl}` : "Cerrada"}</p>
      ) : null}

      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
