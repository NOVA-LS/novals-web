import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { noticiaPorSlug } from "@/lib/consultas";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const noticia = await noticiaPorSlug(slug);
  if (!noticia) return { title: "Noticia no encontrada" };

  return {
    title: noticia.title,
    description: noticia.excerpt,
    openGraph: {
      title: noticia.title,
      description: noticia.excerpt,
      images: noticia.coverImage ? [noticia.coverImage] : undefined,
    },
  };
}

export default async function NoticiaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // La misma llamada que en generateMetadata: la segunda sale de la caché.
  const noticia = await noticiaPorSlug(slug);
  if (!noticia) notFound();

  // Todo a la misma anchura: portada, titular y cuerpo. Antes el artículo medía
  // 72rem y el texto 68ch, así que la columna quedaba descolgada a la izquierda
  // bajo una portada que ocupaba el doble.
  return (
    <article className="shell grid max-w-[46rem] gap-[var(--space-lg)] py-[var(--space-2xl)]">
      <Link
        href="/noticias"
        className="meta w-fit hover:text-[var(--color-ink)]"
      >
        ← Noticias
      </Link>

      <header className="grid gap-[var(--space-sm)]">
        <span className="meta">
          {noticia.fecha ?? "Sin fecha"}
          {" · "}
          {noticia.autor}
        </span>
        {/* Sin escalón por ventana: el propio clamp del token ya baja en
            pantallas estrechas. */}
        <h1 className="display text-(length:--text-display-s)">
          {noticia.title}
        </h1>
      </header>

      {noticia.coverImage ? (
        <Image
          src={noticia.coverImage}
          alt=""
          width={1280}
          height={720}
          priority
          sizes="(min-width: 50rem) 46rem, 100vw"
          className="portada-noticia"
        />
      ) : null}

      {/* El HTML viene ya saneado desde la caché, no del Markdown en crudo. */}
      <div
        className="prose prose--articulo"
        dangerouslySetInnerHTML={{ __html: noticia.html }}
      />
    </article>
  );
}
