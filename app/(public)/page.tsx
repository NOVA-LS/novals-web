import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { fotosDePortada, noticiasDePortada } from "@/lib/consultas";
import { cn } from "@/lib/utils";
import { HeroCarrusel } from "@/components/hero-carrusel";
import { TarjetasPostulacion } from "@/components/formularios/tarjetas-postulacion";
import { EnlaceBoton } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Nada de esto depende de quién mire, así que sale de la caché y solo se
  // vuelve a consultar cuando el panel toca noticias, galería o formularios.
  const [noticias, fotos] = await Promise.all([
    noticiasDePortada(),
    fotosDePortada(),
  ]);

  return (
    <div className="grid gap-[var(--space-3xl)] pb-[var(--space-3xl)]">
      {/* Portada: las fotos de la galería pasan solas de fondo. */}
      <section className={cn("hero", fotos.length === 0 && "hero--sobrio")}>
        {/* Solo las primeras: el resto se ven abajo, con pie y a tamaño grande. */}
        <HeroCarrusel fotos={fotos.slice(0, 5)} />

        <div className="hero__contenido shell grid content-start justify-items-center gap-[var(--space-lg)] self-start pt-[var(--space-3xl)] pb-[var(--space-3xl)] text-center">
          <Image
            src="/brand/logo_blanco_tight.webp"
            alt="NOVA Los Santos"
            width={1966}
            height={787}
            priority
            sizes="(min-width: 640px) 360px, 240px"
            className="hero__logo h-24 w-auto sm:h-36"
          />

          {/* El titular real se queda para quien usa lector de pantalla; el
              lema de abajo es lo único que se ve. */}
          <h1 className="sr-only">NOVA Los Santos</h1>
          <p className="hero__lema">Tú decides tu propio camino</p>
        </div>
      </section>

      {/* Postulaciones: el estado sale de la base de datos, no está escrito
          a mano. */}
      <section id="postulaciones" className="shell grid gap-[var(--space-lg)] scroll-mt-24">
        <div className="section-head section-head--fila section-head--sinregla">
          <div className="grid gap-[var(--space-2xs)]">
            <h2 className="display text-(length:--text-xl)">Postulaciones</h2>
            <p className="text-[var(--color-muted)]">
              Convocatorias abiertas para diferentes facciones y posiciones.
            </p>
          </div>
          <EnlaceBoton href="/formularios" className="btn--redondo">
            Ver todas
            <ArrowRight size={15} aria-hidden />
          </EnlaceBoton>
        </div>

        {/* Las mismas tarjetas que en la pantalla de postulaciones, con su
            candado y su cuenta atrás: enseñar aquí todo abierto y soltar la
            negativa al entrar era hacer perder el viaje. */}
        <TarjetasPostulacion titulo="h3" limite={6} />
      </section>

      {/* Noticias: las últimas cinco, en fila. */}
      {noticias.length > 0 ? (
        <section className="shell grid gap-[var(--space-lg)]">
          <div className="section-head section-head--fila section-head--sinregla">
            <div className="grid gap-[var(--space-2xs)]">
              <h2 className="display text-(length:--text-xl)">Noticias</h2>
              <p className="text-[var(--color-muted)]">
                Novedades y anuncios del servidor.
              </p>
            </div>
            <EnlaceBoton href="/noticias" className="btn--redondo">
              Ver todas
              <ArrowRight size={15} aria-hidden />
            </EnlaceBoton>
          </div>

          <div className="grid gap-[var(--space-sm)]">
            {noticias.map((noticia) => (
              <Link
                key={noticia.slug}
                href={`/noticias/${noticia.slug}`}
                className="noticia-fila grid gap-[var(--space-md)] sm:grid-cols-[minmax(0,16rem)_1fr] sm:items-start"
              >
                {noticia.coverImage ? (
                  <Image
                    src={noticia.coverImage}
                    alt=""
                    width={320}
                    height={180}
                    className="aspect-video w-full object-cover"
                  />
                ) : null}
                <div className="grid gap-[var(--space-2xs)] pt-[var(--space-sm)]">
                  <div className="flex items-center justify-between gap-[var(--space-sm)]">
                    <span className="display text-(length:--text-lg)">{noticia.title}</span>
                    <span className="meta mr-[var(--space-sm)] flex shrink-0 items-center gap-[var(--space-xs)]">
                      <CalendarDays size={13} aria-hidden />
                      {noticia.fecha ?? "Sin fecha"}
                    </span>
                  </div>
                  <p className="text-base text-[var(--color-muted)]">{noticia.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
