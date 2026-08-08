import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
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

  const discord = process.env.NEXT_PUBLIC_DISCORD_INVITE;

  return (
    <div className="grid gap-[var(--space-3xl)] pb-[var(--space-3xl)]">
      {/* Portada: las fotos de la galería pasan solas de fondo. */}
      <section className={cn("hero", fotos.length === 0 && "hero--sobrio")}>
        {/* Solo las primeras: el resto se ven abajo, con pie y a tamaño grande. */}
        <HeroCarrusel fotos={fotos.slice(0, 5)} />

        <div className="hero__contenido shell grid justify-items-center gap-[var(--space-lg)] py-[var(--space-3xl)] text-center">
          <Image
            src="/brand/logo_blanco_tight.webp"
            alt="NOVA Los Santos"
            width={1966}
            height={787}
            priority
            sizes="(min-width: 640px) 360px, 240px"
            className="hero__logo h-20 w-auto sm:h-28"
          />
          {/* Un escalón por debajo del tamaño de portada: aquí el titular
              acompaña al logo, no compite con él. */}
          <h1 className="hero__titular display max-w-[14ch] text-(length:--text-2xl) sm:text-(length:--text-display-s)">
            Rol serio en Los Santos
          </h1>
          <div className="flex flex-wrap justify-center gap-[var(--space-xs)]">
            <EnlaceBoton href="/formularios" variante="primary">
              Acceder
              <ArrowRight size={16} aria-hidden />
            </EnlaceBoton>
            {discord ? (
              <EnlaceBoton href={discord} target="_blank" rel="noreferrer noopener">
                <MessageCircle size={16} aria-hidden />
                Discord
              </EnlaceBoton>
            ) : null}
          </div>
        </div>
      </section>

      {/* Noticias */}
      {noticias.length > 0 ? (
        <section className="shell grid gap-[var(--space-lg)]">
          <div className="section-head section-head--fila">
            <h2 className="display text-(length:--text-xl)">Últimas noticias</h2>
            <EnlaceBoton href="/noticias">
              Ver todas
              <ArrowRight size={15} aria-hidden />
            </EnlaceBoton>
          </div>

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
                <h3 className="display text-(length:--text-md)">{noticia.title}</h3>
                <p className="text-sm text-[var(--color-muted)]">{noticia.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Postulaciones: el estado sale de la base de datos, no está escrito a mano. */}
      <section id="postulaciones" className="shell grid gap-[var(--space-lg)] scroll-mt-24">
        <div className="section-head section-head--fila">
          <div className="grid gap-[var(--space-2xs)]">
            <h2 className="display text-(length:--text-xl)">Postulaciones</h2>
            <p className="text-[var(--color-muted)]">
              Lo que está abierto ahora mismo.
            </p>
          </div>
          <EnlaceBoton href="/formularios">
            Ver todas
            <ArrowRight size={15} aria-hidden />
          </EnlaceBoton>
        </div>

        {/* Las mismas tarjetas que en la pantalla de postulaciones, con su
            candado y su cuenta atrás: enseñar aquí todo abierto y soltar la
            negativa al entrar era hacer perder el viaje. */}
        <TarjetasPostulacion titulo="h3" />
      </section>

      {/* Cierre */}
      <section className="shell">
        <div className="tile grid gap-[var(--space-md)] sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="grid gap-[var(--space-2xs)]">
            <h2 className="display text-(length:--text-lg)">
              La whitelist se rellena en un rato
            </h2>
            <p className="text-sm text-[var(--color-muted)]">
              Tómatelo en serio y tendrás respuesta en cuanto la revisen.
            </p>
          </div>
          <EnlaceBoton href="/formularios/whitelist" variante="primary">
            Rellenar whitelist
          </EnlaceBoton>
        </div>
      </section>
    </div>
  );
}
