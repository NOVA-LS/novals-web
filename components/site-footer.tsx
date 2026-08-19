import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  const discord = process.env.NEXT_PUBLIC_DISCORD_INVITE;

  return (
    <footer className="mt-[var(--space-3xl)] border-t border-[var(--color-rule)] pt-[var(--space-lg)] pb-[var(--space-xl)]">
      <div className="shell grid gap-[var(--space-xl)]">
        {/* Tres columnas en escritorio: copy, marca y enlaces. En móvil, el
            copy y el logo comparten fila en vez de apilarse uno sobre otro. */}
        <div className="grid items-center justify-items-center gap-[var(--space-lg)] sm:grid-cols-3">
          <Link
            href="/"
            aria-label="NOVA Los Santos · inicio"
            className="flex items-center gap-[var(--space-md)] sm:contents"
          >
            <span className="meta sm:justify-self-start">
              © {new Date().getFullYear()}
              <span className="hidden sm:inline"> · Nova LS</span>
            </span>

            {/* Es el mismo fichero que el logo de la cabecera, así que ya está
                en caché: cargarlo con prisa no cuesta nada y evita que Next lo
                confunda con el LCP, que siempre es el logo de arriba.
                `sm:contents` saca el logo de este enlace en escritorio para que
                vuelva a caer en la columna central del grid. */}
            <Image
              src="/brand/logo_blanco_tight.webp"
              alt="NOVA Los Santos"
              width={1966}
              height={787}
              loading="eager"
              sizes="72px"
              className="h-6 w-auto opacity-70"
            />
          </Link>

          <div className="flex flex-wrap justify-center gap-[var(--space-lg)] sm:justify-self-end">
            <Link href="/noticias" className="nav-link">
              Noticias
            </Link>
            <Link href="/tickets" className="nav-link">
              Soporte
            </Link>
            <Link href="/foro" className="nav-link">
              Foro
            </Link>
            <Link href="/formularios" className="nav-link">
              Postular
            </Link>
            {discord ? (
              <a
                href={discord}
                className="nav-link"
                rel="noreferrer noopener"
                target="_blank"
              >
                Discord
              </a>
            ) : null}
          </div>
        </div>

        {/* Fila legal aparte: enlaces informativos, no navegación principal. */}
        <div className="flex flex-wrap justify-center gap-[var(--space-md)] text-xs text-[var(--color-neutral)]">
          <Link href="/aviso-legal" className="hover:text-[var(--color-ink)] transition-colors">
            Aviso legal
          </Link>
          <Link href="/privacidad" className="hover:text-[var(--color-ink)] transition-colors">
            Privacidad
          </Link>
          <Link href="/cookies" className="hover:text-[var(--color-ink)] transition-colors">
            Cookies
          </Link>
        </div>
      </div>
    </footer>
  );
}
