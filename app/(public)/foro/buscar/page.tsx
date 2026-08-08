import Link from "next/link";
import type { Metadata } from "next";
import { MessageSquare, MessagesSquare, Search } from "lucide-react";
import { db } from "@/lib/db";
import { getCategoria } from "@/lib/foro/categorias";
import { leerPagina, paginar, POR_PAGINA } from "@/lib/paginacion";
import { hace } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Boton } from "@/components/ui/button";
import { Paginacion } from "@/components/ui/paginacion";

export const metadata: Metadata = { title: "Buscar en el foro" };
export const dynamic = "force-dynamic";

/** Trozo del mensaje alrededor de lo buscado, para no enseñarlo entero. */
function recorte(texto: string, buscado: string) {
  const plano = texto.replace(/\s+/g, " ").trim();
  const donde = plano.toLowerCase().indexOf(buscado.toLowerCase());
  if (donde === -1) return plano.slice(0, 160);

  // Un poco de contexto por delante, para que la frase se entienda.
  const desde = Math.max(0, donde - 60);
  const trozo = plano.slice(desde, desde + 200);
  return `${desde > 0 ? "…" : ""}${trozo}${desde + 200 < plano.length ? "…" : ""}`;
}

export default async function BuscarForoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string }>;
}) {
  const { q, p } = await searchParams;
  const buscado = (q ?? "").trim();

  // Dos letras no filtran nada: devolverían el foro entero repartido en páginas.
  const valido = buscado.length >= 3;

  // SQLite no distingue mayúsculas en `contains`, así que basta con esto.
  const enHilos = { OR: [{ title: { contains: buscado } }, { body: { contains: buscado } }] };
  const enRespuestas = { body: { contains: buscado } };

  const [totalHilos, totalRespuestas] = valido
    ? await Promise.all([
        db.thread.count({ where: enHilos }),
        db.reply.count({ where: enRespuestas }),
      ])
    : [0, 0];

  const pagina = paginar(totalHilos + totalRespuestas, POR_PAGINA.hilos, leerPagina(p));

  // Los hilos primero y las respuestas después: quien busca algo casi siempre
  // busca el hilo donde se habló de ello, no el mensaje suelto.
  const hilos = valido
    ? await db.thread.findMany({
        where: enHilos,
        orderBy: { lastReplyAt: "desc" },
        skip: pagina.salta,
        take: pagina.toma,
        select: {
          id: true,
          slug: true,
          title: true,
          body: true,
          category: true,
          lastReplyAt: true,
          author: { select: { username: true, avatar: true } },
          _count: { select: { replies: true } },
        },
      })
    : [];

  const hueco = pagina.toma - hilos.length;
  const respuestas =
    valido && hueco > 0
      ? await db.reply.findMany({
          where: enRespuestas,
          orderBy: { createdAt: "desc" },
          skip: Math.max(0, pagina.salta - totalHilos),
          take: hueco,
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: { username: true, avatar: true } },
            thread: { select: { slug: true, title: true, category: true } },
          },
        })
      : [];

  return (
    <div className="shell grid max-w-[70rem] gap-[var(--space-lg)] py-[var(--space-2xl)]">
      <Link href="/foro" className="meta w-fit hover:text-[var(--color-ink)]">
        ← Foro
      </Link>

      <div className="section-head section-head--fila">
        <h1 className="display text-(length:--text-display-s)">Buscar</h1>
        <form className="buscador">
          <input
            name="q"
            defaultValue={buscado}
            className="input"
            placeholder="Palabra o frase…"
            aria-label="Buscar en el foro"
          />
          <Boton type="submit">
            <Search size={15} aria-hidden />
            Buscar
          </Boton>
        </form>
      </div>

      {!valido ? (
        <p className="text-[var(--color-muted)]">
          {buscado
            ? "Escribe al menos tres letras."
            : "Busca por título o por lo que se dijo dentro de un hilo."}
        </p>
      ) : totalHilos + totalRespuestas === 0 ? (
        <p className="text-[var(--color-muted)]">
          Nada con «{buscado}». Prueba con una palabra más corta.
        </p>
      ) : (
        <>
          <span className="meta">
            {totalHilos} hilo(s) y {totalRespuestas} mensaje(s)
          </span>

          <ul className="grid gap-[var(--space-xs)]">
            {hilos.map((hilo) => (
              <li key={hilo.id}>
                <Link
                  href={`/foro/${hilo.category}/${hilo.slug}`}
                  className="tile tile--link grid gap-[var(--space-2xs)] py-[var(--space-sm)]"
                >
                  <span className="flex items-center gap-[var(--space-sm)]">
                    <MessagesSquare
                      size={14}
                      className="shrink-0 text-[var(--color-muted)]"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{hilo.title}</span>
                    <Badge>
                      {getCategoria(hilo.category)?.nombre ?? hilo.category}
                    </Badge>
                  </span>
                  <span className="respuesta text-sm text-[var(--color-muted)]">
                    {recorte(hilo.body, buscado)}
                  </span>
                  <span className="meta">
                    {hilo.author.username} · {hilo._count.replies} resp. ·{" "}
                    {hace(hilo.lastReplyAt)}
                  </span>
                </Link>
              </li>
            ))}

            {respuestas.map((respuesta) => (
              <li key={respuesta.id}>
                {/* Por la ruta del mensaje: sabe en qué página del hilo cayó. */}
                <Link
                  href={`/foro/mensaje/${respuesta.id}`}
                  className="tile tile--link grid gap-[var(--space-2xs)] py-[var(--space-sm)]"
                >
                  <span className="flex items-center gap-[var(--space-sm)]">
                    <MessageSquare
                      size={14}
                      className="shrink-0 text-[var(--color-muted)]"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {respuesta.thread.title}
                    </span>
                    <Badge>
                      {getCategoria(respuesta.thread.category)?.nombre ??
                        respuesta.thread.category}
                    </Badge>
                  </span>
                  <span className="respuesta text-sm text-[var(--color-muted)]">
                    {recorte(respuesta.body, buscado)}
                  </span>
                  <span className="meta flex items-center gap-[var(--space-xs)]">
                    <Avatar
                      src={respuesta.author.avatar}
                      nombre={respuesta.author.username}
                      size={18}
                    />
                    {respuesta.author.username} · {hace(respuesta.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <Paginacion
            pagina={pagina}
            href={(numero) =>
              `/foro/buscar?q=${encodeURIComponent(buscado)}&p=${numero}`
            }
            etiqueta="Páginas de resultados"
          />
        </>
      )}
    </div>
  );
}
