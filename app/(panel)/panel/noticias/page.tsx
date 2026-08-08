import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { cambiarPublicacion } from "@/lib/actions/posts";
import { formatearFechaHora } from "@/lib/utils";
import { leerPagina, paginar, POR_PAGINA } from "@/lib/paginacion";
import { Paginacion } from "@/components/ui/paginacion";
import { Badge } from "@/components/ui/badge";
import { Boton, EnlaceBoton } from "@/components/ui/button";
import { CabeceraPanel } from "@/components/panel/cabecera-panel";

export const metadata: Metadata = { title: "Noticias del panel" };
export const dynamic = "force-dynamic";

export default async function PanelNoticiasPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  await requireUser("ADMIN");
  const { p } = await searchParams;

  // Las cuentas de la cabecera son de todas, no de las de esta página.
  const [publicadas, borradores] = await Promise.all([
    db.post.count({ where: { published: true } }),
    db.post.count({ where: { published: false } }),
  ]);

  const pagina = paginar(
    publicadas + borradores,
    POR_PAGINA.noticiasPanel,
    leerPagina(p),
  );

  const noticias = await db.post.findMany({
    orderBy: { createdAt: "desc" },
    skip: pagina.salta,
    take: pagina.toma,
    select: {
      id: true,
      slug: true,
      title: true,
      published: true,
      publishedAt: true,
      createdAt: true,
      author: { select: { username: true } },
    },
  });

  return (
    <div className="shell grid gap-[var(--space-lg)] py-[var(--space-xl)]">
      <CabeceraPanel
        titulo="Noticias"
        descripcion={`${publicadas} publicada(s) y ${borradores} en borrador.`}
        acciones={
          <EnlaceBoton href="/panel/noticias/nueva" variante="primary">
            <Plus size={15} aria-hidden />
            Nueva noticia
          </EnlaceBoton>
        }
      />

      {pagina.total === 0 ? (
        <div className="tile grid justify-items-start gap-[var(--space-sm)]">
          <p className="text-[var(--color-muted)]">Todavía no hay ninguna.</p>
          <EnlaceBoton href="/panel/noticias/nueva" variante="primary">
            Escribir la primera
          </EnlaceBoton>
        </div>
      ) : (
        <ul className="grid gap-[var(--space-sm)]">
          {noticias.map((noticia) => (
            <li
              key={noticia.id}
              className="tile flex flex-wrap items-center justify-between gap-[var(--space-md)]"
            >
              <div className="grid gap-[var(--space-2xs)]">
                <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
                  <Link
                    href={`/panel/noticias/${noticia.id}`}
                    className="display text-(length:--text-md) underline-offset-4 hover:underline"
                  >
                    {noticia.title}
                  </Link>
                  <Badge tono={noticia.published ? "accepted" : "neutral"}>
                    {noticia.published ? "Publicada" : "Borrador"}
                  </Badge>
                </div>
                <span className="meta">
                  {noticia.author.username} ·{" "}
                  {formatearFechaHora(noticia.publishedAt ?? noticia.createdAt)}
                </span>
              </div>

              <div className="flex flex-wrap gap-[var(--space-xs)]">
                {noticia.published ? (
                  <EnlaceBoton href={`/noticias/${noticia.slug}`} target="_blank">
                    Ver
                  </EnlaceBoton>
                ) : null}
                <form
                  action={async () => {
                    "use server";
                    await cambiarPublicacion(noticia.id, !noticia.published);
                  }}
                >
                  <Boton type="submit">
                    {noticia.published ? "Despublicar" : "Publicar"}
                  </Boton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Paginacion
        pagina={pagina}
        href={(numero) =>
          numero > 1 ? `/panel/noticias?p=${numero}` : "/panel/noticias"
        }
        etiqueta="Páginas de noticias"
      />
    </div>
  );
}
