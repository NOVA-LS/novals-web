import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Lock, Pin } from "lucide-react";
import { db } from "@/lib/db";
import { actorActual } from "@/lib/foro/actor";
import { getCategoria } from "@/lib/foro/categorias";
import {
  puedeBorrar,
  puedeEditar,
  puedeModerar,
  puedeResponder,
} from "@/lib/foro/reglas";
import { renderMarkdown } from "@/lib/markdown";
import { leerPagina, paginar, POR_PAGINA } from "@/lib/paginacion";
import { formatearFechaHora } from "@/lib/utils";
import { FirmaAutor } from "@/components/foro/firma-autor";
import { FormularioRespuesta } from "@/components/foro/formulario-respuesta";
import { Mensaje } from "@/components/foro/mensaje";
import { ModeracionHilo } from "@/components/foro/moderacion-hilo";
import { EnlaceBoton } from "@/components/ui/button";
import { Paginacion } from "@/components/ui/paginacion";

export const dynamic = "force-dynamic";

const AUTOR = {
  select: {
    id: true,
    username: true,
    avatar: true,
    role: true,
    badges: { select: { slug: true } },
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hilo = await db.thread.findUnique({
    where: { slug },
    select: { title: true },
  });
  return { title: hilo?.title ?? "Hilo" };
}

export default async function HiloPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoria: string; slug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { categoria: slugCategoria, slug } = await params;
  const { p } = await searchParams;
  const categoria = getCategoria(slugCategoria);
  if (!categoria) notFound();

  const [actor, hilo] = await Promise.all([
    actorActual(),
    db.thread.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        pinned: true,
        locked: true,
        authorId: true,
        createdAt: true,
        updatedAt: true,
        author: AUTOR,
        _count: { select: { replies: true } },
      },
    }),
  ]);

  // Un hilo movido de categoría no debe seguir respondiendo por la URL vieja.
  if (!hilo || hilo.category !== slugCategoria) notFound();

  const pagina = paginar(
    hilo._count.replies,
    POR_PAGINA.respuestas,
    leerPagina(p),
  );

  const respuestas = await db.reply.findMany({
    where: { threadId: hilo.id },
    orderBy: { createdAt: "asc" },
    skip: pagina.salta,
    take: pagina.toma,
    select: {
      id: true,
      body: true,
      authorId: true,
      createdAt: true,
      updatedAt: true,
      author: AUTOR,
    },
  });

  // Lo nuevo cae siempre al final del hilo, así que responder solo tiene sentido
  // desde la última página; desde cualquier otra se lleva allí primero.
  const enLaUltima = pagina.actual === pagina.paginas;
  const enlaceUltima = `/foro/${categoria.slug}/${slug}?p=${pagina.paginas}#responder`;

  return (
    <div className="shell grid max-w-[62rem] gap-[var(--space-lg)] py-[var(--space-2xl)]">
      <Link
        href={`/foro/${categoria.slug}`}
        className="meta w-fit hover:text-[var(--color-ink)]"
      >
        ← {categoria.nombre}
      </Link>

      <header className="grid gap-[var(--space-sm)]">
        <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
          {hilo.pinned ? (
            <Pin size={16} className="text-[var(--color-muted)]" aria-hidden />
          ) : null}
          {hilo.locked ? (
            <Lock size={16} className="text-[var(--color-muted)]" aria-hidden />
          ) : null}
          <h1 className="display text-(length:--text-xl)">{hilo.title}</h1>
        </div>

        <ModeracionHilo
          id={hilo.id}
          pinned={hilo.pinned}
          locked={hilo.locked}
          puedeModerar={puedeModerar(actor)}
          puedeBorrar={puedeBorrar(actor, hilo)}
        />
      </header>

      {/* Primer mensaje: vive en el propio hilo, no como respuesta. */}
      <article className="tile grid gap-[var(--space-sm)]">
        <FirmaAutor autor={hilo.author} fecha={formatearFechaHora(hilo.createdAt)} />
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(hilo.body) }}
        />
      </article>

      {respuestas.length > 0 ? (
        <>
          <div className="section-head">
            <h2 className="display text-(length:--text-md)">
              {pagina.total} respuesta(s)
            </h2>
            {pagina.paginas > 1 ? (
              <span className="meta">
                Página {pagina.actual} de {pagina.paginas}
              </span>
            ) : null}
          </div>

          <ul className="grid gap-[var(--space-md)]">
            {respuestas.map((respuesta) => (
              // El ancla deja enlazar un mensaje suelto desde el perfil del autor.
              <li key={respuesta.id} id={`m-${respuesta.id}`} className="scroll-mt-24">
                <Mensaje
                  id={respuesta.id}
                  html={renderMarkdown(respuesta.body)}
                  body={respuesta.body}
                  autor={respuesta.author}
                  fecha={formatearFechaHora(respuesta.createdAt)}
                  editado={
                    respuesta.updatedAt.getTime() - respuesta.createdAt.getTime() > 1000
                  }
                  puedeEditar={puedeEditar(actor, respuesta)}
                  puedeBorrar={puedeBorrar(actor, respuesta)}
                />
              </li>
            ))}
          </ul>

          <Paginacion
            pagina={pagina}
            href={(numero) => `/foro/${categoria.slug}/${slug}?p=${numero}`}
            etiqueta="Páginas del hilo"
          />
        </>
      ) : null}

      {puedeResponder(actor, hilo) ? (
        enLaUltima ? (
          <div id="responder" className="scroll-mt-24">
            <FormularioRespuesta threadId={hilo.id} />
          </div>
        ) : (
          <div className="tile flex flex-wrap items-center justify-between gap-[var(--space-sm)]">
            <p className="text-sm text-[var(--color-muted)]">
              Las respuestas nuevas van al final del hilo.
            </p>
            <EnlaceBoton href={enlaceUltima} variante="primary">
              Ir al final y responder
            </EnlaceBoton>
          </div>
        )
      ) : (
        <p className="tile text-sm text-[var(--color-muted)]">
          {hilo.locked
            ? "Este hilo está cerrado."
            : "Para escribir en el foro necesitas la whitelist aceptada."}
        </p>
      )}
    </div>
  );
}
