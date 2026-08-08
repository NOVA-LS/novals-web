import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Hand,
  Lightbulb,
  MessageSquare,
  Pin,
  Search,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { CATEGORIAS, getCategoria } from "@/lib/foro/categorias";
import { actorActual } from "@/lib/foro/actor";
import { puedePublicar } from "@/lib/foro/reglas";
import { hace } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Boton, EnlaceBoton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Foro" };
export const dynamic = "force-dynamic";

// Los iconos que nombra lib/foro/categorias.ts. Mapa cerrado para no arrastrar
// la librería entera al navegador.
const ICONOS: Record<string, LucideIcon> = { Hand, Lightbulb, Wrench };

/** Lo que se enseña de un hilo en las listas de esta página. */
const RESUMEN = {
  id: true,
  slug: true,
  title: true,
  category: true,
  pinned: true,
  lastReplyAt: true,
  author: { select: { username: true, avatar: true } },
  _count: { select: { replies: true } },
} as const;

export default async function ForoPage() {
  const [actor, recientes, ultimos] = await Promise.all([
    actorActual(),
    db.thread.findMany({
      orderBy: [{ pinned: "desc" }, { lastReplyAt: "desc" }],
      take: 8,
      select: RESUMEN,
    }),
    // El último hilo de cada categoría: es lo que dice de un vistazo dónde hay
    // movimiento, que es a lo que se entra a un foro.
    Promise.all(
      CATEGORIAS.map((categoria) =>
        db.thread.findFirst({
          where: { category: categoria.slug },
          orderBy: { lastReplyAt: "desc" },
          select: RESUMEN,
        }),
      ),
    ),
  ]);

  const ultimoDe = new Map(
    CATEGORIAS.map((categoria, indice) => [categoria.slug, ultimos[indice]]),
  );

  return (
    <div className="shell grid max-w-[70rem] gap-[var(--space-xl)] py-[var(--space-2xl)]">
      <header className="flex flex-wrap items-end justify-between gap-[var(--space-md)]">
        <div className="grid gap-[var(--space-2xs)]">
          <h1 className="display text-(length:--text-display-s)">Foro</h1>
          <p className="text-[var(--color-muted)]">
            Leer lo puede todo el mundo. Escribir, quien ya pasó la whitelist.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
          <form className="buscador" action="/foro/buscar">
            <input
              name="q"
              className="input"
              placeholder="Buscar en el foro…"
              aria-label="Buscar en el foro"
            />
            <Boton type="submit">
              <Search size={15} aria-hidden />
              Buscar
            </Boton>
          </form>

          {puedePublicar(actor) ? (
            <EnlaceBoton href="/foro/nuevo" variante="primary">
              Abrir hilo
            </EnlaceBoton>
          ) : (
            <EnlaceBoton href="/formularios/whitelist">
              Pedir la whitelist
              <ArrowRight size={15} aria-hidden />
            </EnlaceBoton>
          )}
        </div>
      </header>

      {/* Las categorías, en filas y con su último hilo al lado: una rejilla de
          tarjetas iguales no dice en cuál está pasando algo. */}
      <section className="grid gap-[var(--space-xs)]">
        {CATEGORIAS.map((categoria) => {
          const Icono = ICONOS[categoria.icono] ?? MessageSquare;
          const ultimo = ultimoDe.get(categoria.slug);

          return (
            <Link
              key={categoria.slug}
              href={`/foro/${categoria.slug}`}
              className="tile tile--link categoria"
            >
              <Icono
                size={22}
                className="categoria__icono text-[var(--color-muted)]"
                aria-hidden
              />

              <span className="grid min-w-0 gap-[var(--space-2xs)]">
                <span className="display text-(length:--text-md)">
                  {categoria.nombre}
                </span>
                <span className="text-sm text-[var(--color-muted)]">
                  {categoria.descripcion}
                </span>
              </span>

              {ultimo ? (
                <span className="categoria__ultimo">
                  <span className="flex items-center gap-[var(--space-xs)]">
                    <Avatar
                      src={ultimo.author.avatar}
                      nombre={ultimo.author.username}
                      size={22}
                    />
                    <span className="min-w-0 truncate text-sm">{ultimo.title}</span>
                  </span>
                  <span className="meta">
                    {ultimo.author.username} · {hace(ultimo.lastReplyAt)}
                  </span>
                </span>
              ) : (
                <span className="categoria__ultimo">
                  <span className="meta">Sin estrenar</span>
                </span>
              )}
            </Link>
          );
        })}
      </section>

      {recientes.length > 0 ? (
        <section className="grid gap-[var(--space-md)]">
          <div className="section-head">
            <h2 className="display text-(length:--text-lg)">Lo último</h2>
          </div>

          <ul className="grid gap-[var(--space-xs)]">
            {recientes.map((hilo) => (
              <li key={hilo.id}>
                <Link
                  href={`/foro/${hilo.category}/${hilo.slug}`}
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
                    <Avatar
                      src={hilo.author.avatar}
                      nombre={hilo.author.username}
                      size={24}
                    />
                    <span className="min-w-0 flex-1 truncate">{hilo.title}</span>
                    <Badge>{getCategoria(hilo.category)?.nombre ?? hilo.category}</Badge>
                  </span>
                  <span className="meta">
                    {hilo.author.username} · {hilo._count.replies} resp. ·{" "}
                    {hace(hilo.lastReplyAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
