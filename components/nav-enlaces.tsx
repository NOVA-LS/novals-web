"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LifeBuoy, MessagesSquare, Newspaper } from "lucide-react";
import { IconoDiscord } from "@/components/icono-discord";

// Los mismos destinos que el pie, para quien no quiere bajar hasta él. Los
// iconos son componentes (funciones), así que no pueden venir de props desde
// un server component: viven aquí, no en SiteHeader.
const ENLACES = [
  { href: "/noticias", texto: "Noticias", Icono: Newspaper },
  { href: "/tickets", texto: "Soporte", Icono: LifeBuoy },
  { href: "/foro", texto: "Foro", Icono: MessagesSquare },
  { href: "/formularios", texto: "Postular", Icono: FileText },
];

/**
 * Los enlaces del navbar, marcando el que corresponde a la página actual.
 *
 * Aparte de SiteHeader porque saber la ruta actual pide `usePathname`, que
 * es de cliente, y el resto de la cabecera (usuario, staff, avisos) sale
 * del servidor.
 */
export function NavEnlaces({ discord }: { discord?: string }) {
  const pathname = usePathname();

  return (
    <nav className="hidden flex-1 items-center justify-center gap-[var(--space-xl)] md:flex">
      {ENLACES.map(({ href, texto, Icono }) => {
        const activo = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            data-activo={activo ? "true" : undefined}
            className="nav-link nav-link--cabecera flex items-center gap-[var(--space-2xs)]"
          >
            <Icono size={15} aria-hidden />
            {texto}
          </Link>
        );
      })}
      {discord ? (
        <a
          href={discord}
          target="_blank"
          rel="noreferrer noopener"
          className="nav-link nav-link--cabecera flex items-center gap-[var(--space-2xs)]"
        >
          <IconoDiscord size={15} />
          Discord
        </a>
      ) : null}
    </nav>
  );
}
