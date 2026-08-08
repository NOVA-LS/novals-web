"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Mantiene la página al día sin recargarla.
 *
 * Deja abierto un canal con el servidor y, en cuanto llega el aviso de que algo
 * se movió, vuelve a pedir lo que pinta el servidor. `router.refresh()` cambia
 * solo lo que cambió: no se pierde lo que estés escribiendo ni la posición.
 *
 * El navegador reconecta solo si el canal se corta, así que no hay que
 * vigilarlo. Y por si acaso queda un respaldo lento —una recarga cada tantos
 * minutos— para el caso de que un proxy se coma el flujo y nadie se entere.
 */
export function TiempoReal({ respaldoSegundos = 300 }: { respaldoSegundos?: number }) {
  const router = useRouter();
  const ruta = usePathname();

  // El canal del ticket se deduce de la dirección en vez de pasarlo desde la
  // página: así basta con uno de estos en el armazón y no se abren dos
  // conexiones por pestaña, una del armazón y otra de la pantalla.
  const ticket = ticketDeLaRuta(ruta);
  const foro = ruta.startsWith("/foro");

  useEffect(() => {
    const parametros = new URLSearchParams();
    if (ticket) parametros.set("ticket", ticket);
    if (foro) parametros.set("foro", "1");
    const cadena = parametros.toString();
    const url = cadena ? `/api/eventos?${cadena}` : "/api/eventos";

    const fuente = new EventSource(url);
    // Varios avisos seguidos —un mensaje mueve el ticket y la bandeja— se juntan
    // en un solo refresco.
    let pendiente: ReturnType<typeof setTimeout> | undefined;

    function refrescarPronto() {
      clearTimeout(pendiente);
      pendiente = setTimeout(() => router.refresh(), 120);
    }

    fuente.addEventListener("cambio", refrescarPronto);

    const respaldo = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, respaldoSegundos * 1000);

    // Al volver a la pestaña, lo primero es ponerse al día: mientras estaba
    // oculta el navegador pudo dormir la conexión.
    function alVolver() {
      if (!document.hidden) router.refresh();
    }
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      clearTimeout(pendiente);
      clearInterval(respaldo);
      document.removeEventListener("visibilitychange", alVolver);
      fuente.close();
    };
  }, [router, ticket, foro, respaldoSegundos]);

  return null;
}

const RUTA_TICKET = /^\/(?:panel\/)?tickets\/([^/]+)$/;

function ticketDeLaRuta(ruta: string): string | undefined {
  const encontrado = RUTA_TICKET.exec(ruta)?.[1];
  // `/tickets/nuevo` es una pantalla, no un ticket.
  return encontrado === "nuevo" ? undefined : encontrado;
}
