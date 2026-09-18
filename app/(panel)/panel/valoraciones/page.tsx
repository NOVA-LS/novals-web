import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { haceDias, notaMedia } from "@/lib/stats";
import { leerPagina, paginar, POR_PAGINA } from "@/lib/paginacion";
import { formatearFechaHora } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { CabeceraPanel } from "@/components/panel/cabecera-panel";
import { Paginacion } from "@/components/ui/paginacion";
import { NivelTicket } from "@/components/tickets/estado-ticket";

export const metadata: Metadata = { title: "Valoraciones" };
export const dynamic = "force-dynamic";

/** Qué significa cada nota, dicho igual que se le enseñó a quien la puso. */
const TEXTO: Record<number, string> = {
  0: "Muy mal",
  1: "Mal",
  2: "Regular",
  3: "Bien",
  4: "Muy bien",
  5: "Inmejorable",
};

/** Baja de verdad: a partir de aquí conviene mirar qué pasó en ese ticket. */
const FLOJA = 2;

/**
 * Valoraciones que hacen falta para entrar en el mejor y el peor.
 *
 * Con una sola nota, quien tuvo mala suerte un martes aparece como el peor del
 * staff. Tres no es una muestra, pero ya no es una anécdota.
 */
const MINIMO_PARA_RANKING = 3;

export default async function ValoracionesPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  // Solo administración: aquí se compara el trabajo de unos con el de otros, y
  // se leen tickets de cualquier escalón, donaciones incluidas.
  await requireUser("ADMIN");

  const alcance = { valoradoAt: { not: null } } as const;

  const { p } = await searchParams;
  const cuantas = await db.ticket.count({ where: alcance });
  const pagina = paginar(cuantas, POR_PAGINA.valoraciones, leerPagina(p));

  const [valoradas, todas, ultimoMes, porStaff] = await Promise.all([
    db.ticket.findMany({
      where: alcance,
      orderBy: { valoradoAt: "desc" },
      skip: pagina.salta,
      take: pagina.toma,
      select: {
        id: true,
        numero: true,
        subject: true,
        nivel: true,
        valoracion: true,
        valoracionNota: true,
        valoradoAt: true,
        author: { select: { id: true, username: true, avatar: true } },
        assignee: { select: { username: true } },
      },
    }),
    db.ticket.aggregate({
      where: alcance,
      _avg: { valoracion: true },
      _count: { valoracion: true },
    }),
    db.ticket.aggregate({
      where: { ...alcance, valoradoAt: { gte: haceDias(30) } },
      _avg: { valoracion: true },
      _count: { valoracion: true },
    }),
    // Cómo le va a cada uno de los que atienden.
    db.ticket.groupBy({
      by: ["assigneeId"],
      where: { ...alcance, assigneeId: { not: null } },
      _avg: { valoracion: true },
      _count: { valoracion: true },
    }),
  ]);

  // Los nombres de quienes aparecen en el desglose, en una sola consulta.
  const nombres = new Map(
    porStaff.length > 0
      ? (
          await db.user.findMany({
            where: {
              id: { in: porStaff.map((fila) => fila.assigneeId as string) },
            },
            select: { id: true, username: true, avatar: true },
          })
        ).map((persona) => [persona.id, persona])
      : [],
  );

  const porPersona = porStaff
    .map((fila) => ({
      persona: nombres.get(fila.assigneeId as string),
      media: fila._avg.valoracion ?? 0,
      cuantas: fila._count.valoracion,
    }))
    .filter((fila) => fila.persona && fila.cuantas > 0)
    .sort((a, b) => b.media - a.media);

  // De todo el desglose solo salen dos nombres: no hay tabla de clasificación,
  // que es una manera rápida de picar a la gente por algo que depende de qué
  // tickets le tocaron.
  const enRanking = porPersona.filter(
    (fila) => fila.cuantas >= MINIMO_PARA_RANKING,
  );
  const mejor = enRanking.length >= 2 ? enRanking[0] : null;
  const peor = enRanking.length >= 2 ? enRanking[enRanking.length - 1] : null;

  return (
    <div className="shell grid max-w-[70rem] gap-[var(--space-lg)] py-[var(--space-xl)]">
      <CabeceraPanel
        titulo="Valoraciones"
        descripcion="Lo que dicen los jugadores de cómo se les atendió, al cerrarles el ticket."
      />

      <dl className="flex flex-wrap gap-[var(--space-xl)] border-y border-[var(--color-rule)] py-[var(--space-md)]">
        <div className="grid gap-[var(--space-2xs)]">
          <dt className="meta">Últimos 30 días</dt>
          <dd className="display text-(length:--text-xl) tabular-nums">
            {ultimoMes._avg.valoracion === null
              ? "—"
              : `${notaMedia(ultimoMes._avg.valoracion)}/5`}
          </dd>
          <dd className="meta">{ultimoMes._count.valoracion} valoración(es)</dd>
        </div>

        <div className="grid gap-[var(--space-2xs)]">
          <dt className="meta">Desde siempre</dt>
          <dd className="display text-(length:--text-xl) tabular-nums">
            {todas._avg.valoracion === null
              ? "—"
              : `${notaMedia(todas._avg.valoracion)}/5`}
          </dd>
          <dd className="meta">{todas._count.valoracion} valoración(es)</dd>
        </div>

        {mejor && peor ? (
          <>
            <div className="grid gap-[var(--space-2xs)]">
              <dt className="meta">Mejor valorado</dt>
              <dd className="display text-(length:--text-xl)">
                {mejor.persona!.username}
              </dd>
              <dd className="meta">
                {notaMedia(mejor.media)}/5 · {mejor.cuantas} ticket(s)
              </dd>
            </div>

            <div className="grid gap-[var(--space-2xs)]">
              <dt className="meta">Peor valorado</dt>
              <dd className="display text-(length:--text-xl)">
                {peor.persona!.username}
              </dd>
              <dd className="meta">
                {notaMedia(peor.media)}/5 · {peor.cuantas} ticket(s)
              </dd>
            </div>
          </>
        ) : null}
      </dl>

      <section className="grid gap-[var(--space-sm)]">
        <h2 className="display text-(length:--text-lg)">Una a una</h2>

        {valoradas.length === 0 ? (
          <p className="tile text-sm text-[var(--color-muted)]">
            Todavía no hay ninguna. Se piden solas al cerrar un ticket: quien lo
            abrió recibe el aviso y puntúa del 0 al 5.
          </p>
        ) : (
          <ul className="grid gap-[var(--space-sm)]">
            {valoradas.map((ticket) => (
              <li key={ticket.id} className="tile grid gap-[var(--space-sm)]">
                <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
                  {/* La nota primero y grande: es lo que se viene a mirar. */}
                  <span
                    className="display text-(length:--text-lg) tabular-nums"
                    style={
                      ticket.valoracion !== null && ticket.valoracion <= FLOJA
                        ? { color: "var(--color-rejected)" }
                        : undefined
                    }
                  >
                    {ticket.valoracion}/5
                  </span>
                  <span className="meta">
                    {TEXTO[ticket.valoracion ?? 0]}
                  </span>

                  <Link
                    href={`/panel/tickets/${ticket.id}`}
                    className="min-w-0 flex-1 truncate underline-offset-4 hover:underline"
                  >
                    #{ticket.numero} · {ticket.subject}
                  </Link>

                  <NivelTicket nivel={ticket.nivel} />
                </div>

                {ticket.valoracionNota ? (
                  <p className="respuesta text-sm text-[var(--color-muted)]">
                    {ticket.valoracionNota}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
                  <Link
                    href={`/u/${ticket.author.id}`}
                    className="flex items-center gap-[var(--space-xs)]"
                  >
                    <Avatar
                      src={ticket.author.avatar}
                      nombre={ticket.author.username}
                      size={22}
                    />
                    <span className="meta">{ticket.author.username}</span>
                  </Link>

                  <span className="meta">
                    Lo llevó {ticket.assignee?.username ?? "nadie en concreto"}
                  </span>

                  <span className="meta">
                    {ticket.valoradoAt ? formatearFechaHora(ticket.valoradoAt) : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Paginacion
          pagina={pagina}
          href={(numero) =>
            numero > 1 ? `/panel/valoraciones?p=${numero}` : "/panel/valoraciones"
          }
          etiqueta="Páginas de valoraciones"
        />
      </section>
    </div>
  );
}
