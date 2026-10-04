import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { noticiaPorSlug } from "@/lib/consultas";
import { Avatar } from "@/components/ui/avatar";
import { RolStaff } from "@/components/ui/rol";
import { currentUser } from "@/lib/guards";
import { estadoInteraccion } from "@/lib/interaccion";
import { Encuesta } from "@/components/noticias/encuesta";
import { BotonApoyo } from "@/components/noticias/boton-apoyo";

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

  // Votos y apoyos no entran en la caché de la noticia: cambian en cada visita y
  // dependen de quién mira.
  const usuario = await currentUser();
  const interaccion = await estadoInteraccion(noticia.id, usuario?.id ?? null);
  const hrefEntrar = `/entrar?callbackUrl=${encodeURIComponent(`/noticias/${slug}`)}`;

  // Todo a la misma anchura: portada, titular y cuerpo. Antes el artículo medía
  // 72rem y el texto 68ch, así que la columna quedaba descolgada a la izquierda
  // bajo una portada que ocupaba el doble.
  return (
    <article className="shell grid max-w-[46rem] gap-[var(--space-lg)] py-[var(--space-2xl)]">
      <Link href="/noticias" className="enlace-volver w-fit">
        <ArrowLeft size={14} aria-hidden />
        Noticias
      </Link>

      <header className="grid gap-[var(--space-sm)]">
        {/* Sin escalón por ventana: el propio clamp del token ya baja en
            pantallas estrechas. */}
        <h1 className="display text-(length:--text-display-s)">
          {noticia.title}
        </h1>

        <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
          <Link
            href={`/u/${noticia.autor.id}`}
            className="flex items-center gap-[var(--space-xs)] hover:text-[var(--color-ink)]"
          >
            <Avatar src={noticia.autor.avatar} nombre={noticia.autor.username} size={28} />
            <span className="text-sm">{noticia.autor.username}</span>
          </Link>

          <RolStaff rol={noticia.autor.role} />

          <span className="meta flex items-center gap-[var(--space-xs)]">
            <CalendarDays size={13} aria-hidden />
            {noticia.fecha ?? "Sin fecha"}
          </span>
        </div>
      </header>

      {noticia.coverImage ? (
        <Image
          src={noticia.coverImage}
          alt=""
          width={noticia.coverWidth}
          height={noticia.coverHeight}
          priority
          // Sin pasar por el optimizador: es la imagen principal de la página y
          // reducirla y recomprimirla otra vez le quita justo el detalle que se
          // guardó. El fichero ya sale en WEBP y se sirve con caché de un año.
          unoptimized
          className="portada-noticia"
        />
      ) : null}

      {/* El HTML viene ya saneado desde la caché, no del Markdown en crudo. */}
      <div
        className="prose prose--articulo"
        dangerouslySetInnerHTML={{ __html: noticia.html }}
      />

      <footer className="grid gap-[var(--space-lg)]">
        {interaccion.encuesta ? (
          <Encuesta
            encuesta={interaccion.encuesta}
            logueado={usuario !== null}
            hrefEntrar={hrefEntrar}
          />
        ) : null}

        <BotonApoyo
          postId={noticia.id}
          apoyos={interaccion.apoyos}
          apoyado={interaccion.apoyado}
          logueado={usuario !== null}
          hrefEntrar={hrefEntrar}
        />
      </footer>
    </article>
  );
}
