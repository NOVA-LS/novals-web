import Link from "next/link";

/**
 * Cabecera de una pantalla del panel.
 *
 * La barra de arriba ya no lleva secciones, así que el camino de vuelta tiene
 * que estar en la propia página. Va en todas para que siempre esté en el mismo
 * sitio y nadie acabe tirando del botón atrás del navegador.
 */
export function CabeceraPanel({
  titulo,
  descripcion,
  volver = { href: "/panel", texto: "Panel" },
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  volver?: { href: string; texto: string };
  acciones?: React.ReactNode;
}) {
  return (
    <div className="grid gap-[var(--space-sm)]">
      <Link href={volver.href} className="meta w-fit hover:text-[var(--color-ink)]">
        ← {volver.texto}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-[var(--space-md)]">
        <div className="grid gap-[var(--space-2xs)]">
          <h1 className="display text-(length:--text-xl)">{titulo}</h1>
          {descripcion ? (
            <p className="text-sm text-[var(--color-muted)]">{descripcion}</p>
          ) : null}
        </div>

        {acciones ? (
          <div className="flex flex-wrap gap-[var(--space-xs)]">{acciones}</div>
        ) : null}
      </div>
    </div>
  );
}
