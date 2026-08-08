"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  ChevronDown,
  LifeBuoy,
  LogOut,
  MessagesSquare,
  User,
} from "lucide-react";
import { salir } from "@/lib/actions/auth";
import { Avatar } from "@/components/ui/avatar";

/**
 * Lo tuyo, recogido bajo el avatar.
 *
 * Sin contadores: lo que queda por revisar se cuenta en el botón de staff, que
 * es donde se va a atenderlo. Dos pastillas con el mismo número, una al lado de
 * la otra, se leen como dos avisos distintos.
 *
 * Está montado sobre <details>: se abre y se cierra sin JavaScript, así que
 * funciona aunque el script tarde. El único añadido es cerrarlo al pulsar fuera
 * o con Escape, que el elemento nativo no hace por su cuenta.
 */
export function MenuUsuario({
  nombre,
  avatar,
  rol,
}: {
  nombre: string;
  avatar: string | null;
  /** Se enseña bajo el nombre. Solo tiene sentido para el staff. */
  rol?: string;
}) {
  const caja = useRef<HTMLDetailsElement>(null);
  const ruta = usePathname();

  // Navegar dentro del menú debe dejarlo cerrado en la página siguiente.
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
      <summary className="menu__boton" aria-label={`Cuenta de ${nombre}`}>
        <Avatar src={avatar} nombre={nombre} size={28} />
        <ChevronDown size={14} className="menu__flecha" aria-hidden />
      </summary>

      <div className="menu__panel">
        <span className="meta menu__nombre">
          {nombre}
          {rol ? ` · ${rol}` : ""}
        </span>

        <Link href="/perfil" className="menu__opcion">
          <User size={15} aria-hidden />
          Mi perfil
        </Link>

        <Link href="/foro" className="menu__opcion">
          <MessagesSquare size={15} aria-hidden />
          Foro
        </Link>

        <Link href="/tickets" className="menu__opcion">
          <LifeBuoy size={15} aria-hidden />
          Mis tickets
        </Link>

        <Link href="/insignias" className="menu__opcion">
          <Award size={15} aria-hidden />
          Insignias
        </Link>

        <form action={salir}>
          <button type="submit" className="menu__opcion menu__opcion--boton">
            <LogOut size={15} aria-hidden />
            Salir
          </button>
        </form>
      </div>
    </details>
  );
}
