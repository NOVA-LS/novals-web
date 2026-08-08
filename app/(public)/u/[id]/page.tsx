import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink, MessageSquare, MessagesSquare } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser, isStaff } from "@/lib/guards";
import { getCategoria } from "@/lib/foro/categorias";
import { formatearFechaHora } from "@/lib/utils";
import { EnlaceBoton } from "@/components/ui/button";
import { CabeceraPerfil } from "@/components/perfil/cabecera-perfil";

export const dynamic = "force-dynamic";

/** Cuántas respuestas se miran para adivinar dónde suele escribir alguien. */
const MUESTRA_RESPUESTAS = 200;

/** Una línea del mensaje, sin marcas de markdown que aquí no se pintan. */
function resumir(texto: string) {
  const plano = texto.replace(/[#>*_`~\[\]]/g, "").replace(/\s+/g, " ").trim();
  return plano.length > 160 ? `${plano.slice(0, 160)}…` : plano;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const usuario = await db.user.findUnique({
    where: { id },
    select: { username: true },
  });
  return { title: usuario?.username ?? "Perfil" };
}

export default async function PerfilPublicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [visitante, perfil] = await Promise.all([
    currentUser(),
    db.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        avatar: true,
        discordId: true,
        role: true,
        whitelisted: true,
        teams: { select: { tag: true } },
        createdAt: true,
        _count: { select: { threads: true, replies: true } },
        badges: {
          // Se ordenan por cuándo las ganó, pero la fecha no sale de aquí.
          orderBy: { grantedAt: "asc" },
          select: { slug: true },
        },
      },
    }),
  ]);

  if (!perfil) notFound();

  const [hilos, respuestas, hilosPorCategoria, muestra] = await Promise.all([
    db.thread.findMany({
      where: { authorId: perfil.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        createdAt: true,
        _count: { select: { replies: true } },
      },
    }),
    db.reply.findMany({
      where: { authorId: perfil.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        body: true,
        createdAt: true,
        thread: { select: { slug: true, title: true, category: true } },
      },
    }),
    db.thread.groupBy({
      by: ["category"],
      where: { authorId: perfil.id },
      _count: { _all: true },
    }),
    // Agrupar respuestas por categoría exigiría bajar la categoría a la tabla de
    // respuestas. No compensa: con las últimas ya se ve dónde se mueve.
    db.reply.findMany({
      where: { authorId: perfil.id },
      orderBy: { createdAt: "desc" },
      take: MUESTRA_RESPUESTAS,
      select: { thread: { select: { category: true } } },
    }),
  ]);

  const porCategoria = new Map<string, number>();
  for (const fila of hilosPorCategoria) {
    porCategoria.set(fila.category, fila._count._all);
  }
  for (const { thread } of muestra) {
    porCategoria.set(thread.category, (porCategoria.get(thread.category) ?? 0) + 1);
  }
  const donde = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);

  const esStaffQuienMira = Boolean(visitante && isStaff(visitante.role));
  const soyYo = visitante?.id === perfil.id;

  return (
    <div className="shell grid max-w-[62rem] gap-[var(--space-xl)] py-[var(--space-2xl)]">
      <CabeceraPerfil
        nombre={perfil.username}
        avatar={perfil.avatar}
        rol={perfil.role}
        equipos={perfil.teams.map((fila) => fila.tag)}
        desde={perfil.createdAt}
        whitelist={perfil.whitelisted}
        // El identificador de Discord no es asunto de cualquiera que pase.
        discordId={esStaffQuienMira ? perfil.discordId : undefined}
        insignias={perfil.badges}
        cifras={[
          { valor: perfil._count.threads, etiqueta: "Hilos" },
          { valor: perfil._count.replies, etiqueta: "Mensajes" },
        ]}
        acciones={
          soyYo ? (
            <EnlaceBoton href="/perfil">
              <ExternalLink size={15} aria-hidden />
              Perfil privado
            </EnlaceBoton>
          ) : null
        }
      />

      {donde.length > 0 ? (
        <section className="grid gap-[var(--space-md)]">
          <div className="section-head">
            <h2 className="display text-(length:--text-lg)">Dónde escribe</h2>
          </div>
          <div className="flex flex-wrap gap-[var(--space-xs)]">
            {donde.map(([categoria, veces]) => (
              <Link key={categoria} href={`/foro/${categoria}`} className="insignia">
                {getCategoria(categoria)?.nombre ?? categoria} · {veces}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-[var(--space-xl)] lg:grid-cols-2">
        <section className="grid content-start gap-[var(--space-md)]">
          <div className="section-head">
            <h2 className="display text-(length:--text-lg)">Hilos que abrió</h2>
          </div>

          {hilos.length === 0 ? (
            <p className="text-[var(--color-muted)]">Ninguno todavía.</p>
          ) : (
            <ul className="grid gap-[var(--space-xs)]">
              {hilos.map((hilo) => (
                <li key={hilo.id}>
                  <Link
                    href={`/foro/${hilo.category}/${hilo.slug}`}
                    className="tile tile--link grid gap-[var(--space-2xs)] py-[var(--space-sm)]"
                  >
                    <span className="flex items-center gap-[var(--space-xs)]">
                      <MessagesSquare
                        size={14}
                        className="shrink-0 text-[var(--color-muted)]"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{hilo.title}</span>
                    </span>
                    <span className="meta">
                      {getCategoria(hilo.category)?.nombre ?? hilo.category} ·{" "}
                      {hilo._count.replies} resp. · {formatearFechaHora(hilo.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid content-start gap-[var(--space-md)]">
          <div className="section-head">
            <h2 className="display text-(length:--text-lg)">Últimos mensajes</h2>
          </div>

          {respuestas.length === 0 ? (
            <p className="text-[var(--color-muted)]">Ninguno todavía.</p>
          ) : (
            <ul className="grid gap-[var(--space-xs)]">
              {respuestas.map((respuesta) => (
                <li key={respuesta.id}>
                  {/* Por la ruta del mensaje, que es la que sabe en qué página
                      del hilo ha quedado. */}
                  <Link
                    href={`/foro/mensaje/${respuesta.id}`}
                    className="tile tile--link grid gap-[var(--space-2xs)] py-[var(--space-sm)]"
                  >
                    <span className="flex items-center gap-[var(--space-xs)]">
                      <MessageSquare
                        size={14}
                        className="shrink-0 text-[var(--color-muted)]"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {respuesta.thread.title}
                      </span>
                    </span>
                    <span className="respuesta text-sm text-[var(--color-muted)]">
                      {resumir(respuesta.body)}
                    </span>
                    <span className="meta">
                      {getCategoria(respuesta.thread.category)?.nombre ??
                        respuesta.thread.category}{" "}
                      · {formatearFechaHora(respuesta.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
