"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Bell, FileCheck2, MessageSquare } from "lucide-react";
import { abrirAviso, marcarTodoLeido } from "@/lib/actions/avisos";
import { TituloAvisos } from "@/components/titulo-avisos";
import type { Aviso } from "@/lib/avisos";

/**
 * Avisos del usuario, bajo una campana.
 *
 * Montada sobre <details>, igual que el menú de la cuenta: se abre sin
 * JavaScript y cada aviso es un formulario, así que marcarlo leído y saltar a
 * donde apunta funciona aunque el script no haya llegado.
 */

const ICONO = {
  RESPUESTA: MessageSquare,
  SOLICITUD: FileCheck2,
  INSIGNIA: Award,
} as const;

/** Los avisos llegan del servidor con Date; aquí solo se enseñan. */
export type AvisoVisto = Omit<Aviso, "createdAt" | "readAt"> & {
  cuando: string;
  leido: boolean;
};

export function Campana({
  avisos,
  sinLeer,
}: {
  avisos: AvisoVisto[];
  sinLeer: number;
}) {
  const caja = useRef<HTMLDetailsElement>(null);
  const ruta = usePathname();

  useEffect(() => {
    if (caja.current) caja.current.open = false;
  }, [ruta]);

  useEffect(() => {
    function alPulsarFuera(evento: MouseEvent) {
      const elemento = caja.current;
      if (!elemento?.open) return;
      if (!elemento.contains(evento.target as Node)) elemento.open = false;
    }

    function alEscapar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      if (caja.current?.open) caja.current.open = false;
    }

    document.addEventListener("click", alPulsarFuera);
    document.addEventListener("keydown", alEscapar);
    return () => {
      document.removeEventListener("click", alPulsarFuera);
      document.removeEventListener("keydown", alEscapar);
    };
  }, []);

  return (
    <details ref={caja} className="menu">
      <TituloAvisos sinLeer={sinLeer} />

      <summary
        className="menu__boton"
        aria-label={sinLeer > 0 ? `Avisos · ${sinLeer} sin leer` : "Avisos"}
      >
        {/* El número se monta sobre la campana, en su esquina: al lado
            ensanchaba el botón cada vez que entraba un aviso. */}
        <span className="campana">
          <Bell size={18} aria-hidden />
          {sinLeer > 0 ? <span className="contador">{sinLeer}</span> : null}
        </span>
      </summary>

      <div className="menu__panel avisos">
        <div className="avisos__cabecera">
          <span className="meta">Avisos</span>
          {sinLeer > 0 ? (
            <form action={marcarTodoLeido}>
              <button type="submit" className="meta avisos__marcar">
                Marcar todo leído
              </button>
            </form>
          ) : null}
        </div>

        {avisos.length === 0 ? (
          <p className="avisos__vacio text-sm text-[var(--color-muted)]">
            Nada por ahora.
          </p>
        ) : (
          <ul className="avisos__lista">
            {avisos.map((aviso) => {
              const Icono = ICONO[aviso.kind as keyof typeof ICONO] ?? Bell;

              return (
                <li key={aviso.id}>
                  <form action={abrirAviso}>
                    <input type="hidden" name="id" value={aviso.id} />
                    <button
                      type="submit"
                      className="aviso"
                      data-nuevo={!aviso.leido}
                    >
                      <Icono size={15} className="aviso__icono" aria-hidden />
                      <span className="aviso__texto">
                        <span className="aviso__titulo">{aviso.title}</span>
                        {aviso.body ? (
                          <span className="aviso__cuerpo">{aviso.body}</span>
                        ) : null}
                        <span className="meta">{aviso.cuando}</span>
                      </span>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        <Link href="/avisos" className="menu__opcion">
          Ver todos
        </Link>
      </div>
    </details>
  );
}
