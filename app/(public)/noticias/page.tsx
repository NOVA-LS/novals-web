import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { contarNoticias, paginaDeNoticias } from "@/lib/consultas";
import { leerPagina, paginar, POR_PAGINA } from "@/lib/paginacion";
import { Paginacion } from "@/components/ui/paginacion";

export const metadata: Metadata = { title: "Noticias" };
export const dynamic = "force-dynamic";

export default async function NoticiasPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;

  // El total se cuenta antes de leer nada: es lo que decide cuántas páginas hay
  // y, por tanto, en cuál acaba cayendo la que se ha pedido.
  const total = await contarNoticias();
  const pagina = paginar(total, POR_PAGINA.noticias, leerPagina(p));
  const noticias = await paginaDeNoticias(pagina.salta, pagina.toma);

  return (
    <div className="shell grid gap-[var(--space-xl)] py-[var(--space-2xl)]">
      <Link href="/" className="meta w-fit hover:text-[var(--color-ink)]">
        ← Inicio
      </Link>

      <h1 className="display text-(length:--text-display-s)">Noticias</h1>

      {noticias.length === 0 ? (
        <p className="text-[var(--color-muted)]">Aún no hay nada publicado.</p>
      ) : (
        <>
          <div className="grid gap-[var(--space-md)] sm:grid-cols-2 lg:grid-cols-3">
            {noticias.map((noticia) => (
              <Link
                key={noticia.slug}
                href={`/noticias/${noticia.slug}`}
                className="tile grid content-start gap-[var(--space-sm)]"
              >
                {noticia.coverImage ? (
                  <Image
                    src={noticia.coverImage}
                    alt=""
                    width={640}
                    height={360}
                    className="aspect-video w-full rounded-[var(--radius-sm)] object-cover"
                  />
                ) : null}
                <span className="meta">{noticia.fecha ?? "Sin fecha"}</span>
                <h2 className="display text-(length:--text-md)">{noticia.title}</h2>
                <p className="text-sm text-[var(--color-muted)]">{noticia.excerpt}</p>
              </Link>
            ))}
          </div>

          <Paginacion
            pagina={pagina}
            href={(numero) => `/noticias?p=${numero}`}
            etiqueta="Páginas de noticias"
          />
        </>
      )}
    </div>
  );
}
