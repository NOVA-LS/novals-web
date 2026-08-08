"use client";

import { useEffect } from "react";
import { marcarPresencia } from "@/lib/actions/tickets";
import { LATIDO_SEGUNDOS } from "@/lib/tickets/presencia";

/**
 * Mientras el ticket esté abierto, avisa de que sigues delante.
 *
 * Solo eso: traer lo nuevo es cosa del canal de eventos, que llega en cuanto
 * pasa algo. Este latido existe porque «estar mirando» no es un suceso, es un
 * estado, y hay que renovarlo cada poco para saber que sigue siendo cierto.
 *
 * Con la pestaña en segundo plano se calla. Así nadie aparece como presente por
 * tener el ticket olvidado en una pestaña.
 */
export function LatidoTicket({ id }: { id: string }) {
  useEffect(() => {
    let temporizador: ReturnType<typeof setInterval> | undefined;

    function latir() {
      void marcarPresencia(id);
    }

    function arrancar() {
      detener();
      temporizador = setInterval(latir, LATIDO_SEGUNDOS * 1000);
    }

    function detener() {
      if (temporizador) clearInterval(temporizador);
      temporizador = undefined;
    }

    function alCambiarVisibilidad() {
      if (document.hidden) {
        detener();
        return;
      }
      latir();
      arrancar();
    }

    if (!document.hidden) {
      void marcarPresencia(id);
      arrancar();
    }
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      detener();
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [id]);

  return null;
}
