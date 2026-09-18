"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export type FotoPublica = {
  id: string;
  url: string;
  width: number;
  height: number;
  caption: string | null;
};

const INTERVALO_MS = 6000;

/**
 * Fondo de la portada: las fotos se van fundiendo unas con otras.
 *
 * Todas se apilan y solo cambia la opacidad, así el navegador no tiene que
 * decodificar nada a mitad de transición y el cambio no da tirones.
 */
export function HeroCarrusel({ fotos }: { fotos: FotoPublica[] }) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (fotos.length < 2) return;

    // Quien pide menos movimiento se queda con la primera foto fija.
    const quietud = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (quietud.matches) return;

    const reloj = setInterval(() => {
      // En una pestaña de fondo no gastamos trabajo en algo que nadie ve.
      if (document.hidden) return;
      setIndice((actual) => (actual + 1) % fotos.length);
    }, INTERVALO_MS);

    return () => clearInterval(reloj);
  }, [fotos.length]);

  if (fotos.length === 0) return null;

  return (
    <>
      <div className="hero__fondo" aria-hidden>
        {fotos.map((foto, posicion) => (
          <Image
            key={foto.id}
            src={foto.url}
            alt=""
            fill
            priority={posicion === 0}
            sizes="100vw"
            className="hero__foto"
            data-visible={posicion === indice ? "" : undefined}
          />
        ))}
      </div>

      {fotos.length > 1 ? (
        <div className="hero__puntos" role="tablist" aria-label="Fotos de la portada">
          {fotos.map((foto, posicion) => (
            <button
              key={foto.id}
              type="button"
              role="tab"
              aria-selected={posicion === indice}
              aria-label={`Foto ${posicion + 1}`}
              className="hero__punto"
              data-activo={posicion === indice ? "" : undefined}
              onClick={() => setIndice(posicion)}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
