import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="footer-bar mt-[var(--space-3xl)]">
      <div className="shell grid gap-[var(--space-lg)] py-[var(--space-lg)]">
        {/* Tres columnas en escritorio: copy, marca y enlaces legales. En
            móvil, el copy y el logo comparten fila en vez de apilarse uno
            sobre otro. La navegación principal ya vive en la cabecera. */}
        <div className="grid items-center justify-items-center gap-[var(--space-lg)] sm:grid-cols-3">
          <Link
            href="/"
            aria-label="NOVA Los Santos · inicio"
            className="flex items-center gap-[var(--space-md)] sm:contents"
          >
            <span className="meta sm:justify-self-start">
              © {new Date().getFullYear()}
              <span className="hidden sm:inline"> · Nova</span>
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
            <Link href="/aviso-legal" className="nav-link">
              Aviso legal
            </Link>
            <Link href="/privacidad" className="nav-link">
              Privacidad
            </Link>
            <Link href="/cookies" className="nav-link">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
