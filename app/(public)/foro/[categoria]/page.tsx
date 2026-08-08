import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Lock, Pin } from "lucide-react";
import { db } from "@/lib/db";
import { actorActual } from "@/lib/foro/actor";
import { CATEGORIAS, getCategoria } from "@/lib/foro/categorias";
import { puedePublicar } from "@/lib/foro/reglas";
import { leerPagina, paginar, POR_PAGINA } from "@/lib/paginacion";
import { formatearFechaHora } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { EnlaceBoton } from "@/components/ui/button";
import { Paginacion } from "@/components/ui/paginacion";

export const dynamic = "force-dynamic";

/** Cuántos hilos fijados se enseñan encima de la lista. */
const MAX_FIJADOS = 20;

/** Lo que se enseña de un hilo en la lista. */
const RESUMEN = {
  id: true,
  slug: true,
  title: true,
  pinned: true,
  locked: true,
  lastReplyAt: true,
  author: { select: { username: true, avatar: true } },
  _count: { select: { replies: true } },
} as const;

export function generateStaticParams() {
  return CATEGORIAS.map((categoria) => ({ categoria: categoria.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoria: string }>;
}): Promise<Metadata> {
  const { categoria } = await params;
  return { title: getCategoria(categoria)?.nombre ?? "Foro" };
}

export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoria: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { categoria: slug } = await params;
  const { p } = await searchParams;
  const categoria = getCategoria(slug);
  if (!categoria) notFound();

  // Solo se pagina lo corriente. Los fijados van aparte y salen en todas las
  // páginas: son avisos, y quien entre por la tercera tiene que verlos igual.
  const total = await db.thread.count({
    where: { category: slug, pinned: false },
  });
  const pagina = paginar(total, POR_PAGINA.hilos, leerPagina(p));

  const [actor, fijados, hilos] = await Promise.all([
    actorActual(),
    // Los fijados van fuera de la paginación —salen en todas las páginas— así
    // que llevan su propio tope: fijar veinte hilos ya no es fijar nada.
    db.thread.findMany({
      where: { category: slug, pinned: true },
      orderBy: { lastReplyAt: "desc" },
      take: MAX_FIJADOS,
      select: RESUMEN,
    }),
    db.thread.findMany({
      where: { category: slug, pinned: false },
      orderBy: { lastReplyAt: "desc" },
      skip: pagina.salta,
      take: pagina.toma,
      select: RESUMEN,
    }),
  ]);

  const listado = [...fijados, ...hilos];

  return (
    <div className="shell grid max-w-[70rem] gap-[var(--space-lg)] py-[var(--space-2xl)]">
      <Link href="/foro" className="meta w-fit hover:text-[var(--color-ink)]">
        ← Foro
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-[var(--space-md)]">
        <div className="grid gap-[var(--space-2xs)]">
          <h1 className="display text-(length:--text-xl)">{categoria.nombre}</h1>
          <p className="text-[var(--color-muted)]">{categoria.descripcion}</p>
        </div>

        {puedePublicar(actor) ? (
          <EnlaceBoton href={`/foro/nuevo?categoria=${slug}`} variante="primary">
            Abrir hilo
          </EnlaceBoton>
        ) : null}
      </header>

      {listado.length === 0 ? (
        <p className="text-[var(--color-muted)]">
          Todavía no hay hilos aquí. Estrénalo tú.
        </p>
      ) : (
        <ul className="grid gap-[var(--space-xs)]">
          {listado.map((hilo) => (
            <li key={hilo.id}>
              <Link
                href={`/foro/${slug}/${hilo.slug}`}
                className="tile tile--link grid gap-[var(--space-2xs)] py-[var(--space-sm)]"
              >
                <span className="flex items-center gap-[var(--space-sm)]">
                  {hilo.pinned ? (
                    <Pin
                      size={14}
                      className="shrink-0 text-[var(--color-muted)]"
                      aria-hidden
                    />
                  ) : null}
                  {hilo.locked ? (
                    <Lock
                      size={14}
                      className="shrink-0 text-[var(--color-muted)]"
                      aria-hidden
                    />
                  ) : null}
                  <Avatar
                    src={hilo.author.avatar}
                    nombre={hilo.author.username}
                    size={24}
                  />
                  <span className="min-w-0 flex-1 truncate">{hilo.title}</span>
                </span>
                <span className="meta">
                  {hilo.author.username} · {hilo._count.replies} resp. · último{" "}
                  {formatearFechaHora(hilo.lastReplyAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Paginacion
        pagina={pagina}
        href={(numero) => `/foro/${slug}?p=${numero}`}
        etiqueta={`Páginas de ${categoria.nombre}`}
      />
    </div>
  );
}
