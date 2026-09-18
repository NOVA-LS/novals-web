"use client";

import { useEffect } from "react";

/**
 * Pone la cuenta de avisos sin leer en el título de la pestaña.
 *
 * Es lo único que se ve de la web cuando está en segundo plano, que es
 * justamente cuando llega una respuesta y nadie se entera.
 *
 * El título lo escribe Next en cada navegación, así que no basta con ponerlo una
 * vez: se vigila el elemento y se vuelve a anteponer cuando lo pisan.
 */
export function TituloAvisos({ sinLeer }: { sinLeer: number }) {
  useEffect(() => {
    const titulo = document.querySelector("title");
    if (!titulo) return;

    const marca = /^\(\d+\)\s*/;
    let propio = false;

    function aplicar() {
      // Evita reaccionar al cambio que acaba de hacer este mismo efecto.
      if (propio) {
        propio = false;
        return;
      }

      const limpio = document.title.replace(marca, "");
      const nuevo = sinLeer > 0 ? `(${sinLeer}) ${limpio}` : limpio;
      if (nuevo === document.title) return;

      propio = true;
      document.title = nuevo;
    }

    aplicar();

    const vigilante = new MutationObserver(aplicar);
    vigilante.observe(titulo, { childList: true });

    return () => {
      vigilante.disconnect();
      document.title = document.title.replace(marca, "");
    };
  }, [sinLeer]);

  return null;
}
