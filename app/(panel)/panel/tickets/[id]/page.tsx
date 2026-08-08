import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronDown, ChevronUp } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { getCategoriaTicket } from "@/lib/tickets/categorias";
import {
  atiende,
  nivelAnterior,
  NIVELES,
  puedeCerrar,
  puedeEscribir,
  puedeInvitar,
  puedeReabrir,
  siguienteNivel,
} from "@/lib/tickets/reglas";
import { componerParticipantes } from "@/lib/tickets/gente";
import { estaMirando } from "@/lib/tickets/presencia";
import { cerrarTicket, moverTicket, reabrirTicket } from "@/lib/actions/tickets";
import { formatearFechaHora, hace } from "@/lib/utils";
import { Boton } from "@/components/ui/button";
import { Conversacion } from "@/components/tickets/conversacion";
import { DatosTicket } from "@/components/tickets/datos-ticket";
import {
  EstadoTicket,
  explicaEstado,
  NIVEL_TEXTO,
  NivelTicket,
} from "@/components/tickets/estado-ticket";
import { leerPagina, paginar, POR_PAGINA, ULTIMA } from "@/lib/paginacion";
import { Paginacion } from "@/components/ui/paginacion";
import { LatidoTicket } from "@/components/tickets/latido";
import { Participantes } from "@/components/tickets/participantes";
import { ResponderTicket } from "@/components/tickets/responder-ticket";

export const metadata: Metadata = { title: "Ticket" };
export const dynamic = "force-dynamic";

export default async function PanelTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const staff = await requireUser("INICIADOR");
  const { id } = await params;
  const { m } = await searchParams;

  const ticket = await db.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      subject: true,
      category: true,
      answers: true,
      status: true,
      nivel: true,
      authorId: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          username: true,
          discordId: true,
          createdAt: true,
          avatar: true,
          role: true,
        },
      },
      invitados: {
        select: {
          user: {
            select: { id: true, username: true, avatar: true, role: true },
          },
        },
      },
      presencias: {
        select: {
          seenAt: true,
          user: {
            select: { id: true, username: true, avatar: true, role: true },
          },
        },
      },
      assigneeId: true,
      assignee: { select: { username: true, avatar: true } },
      lastMessageAt: true,
      valoracion: true,
      valoracionNota: true,
      valoradoAt: true,
    },
  });

  const actor = { id: staff.id, role: staff.role };
  const vista = ticket
    ? { ...ticket, invitados: ticket.invitados.map((fila) => fila.user.id) }
    : null;

  // Quien no llega al escalón no debe ni saber que existe.
  if (!ticket || !vista || !atiende(actor, vista)) notFound();

  // Por páginas, como en la vista del jugador: aquí además entran las notas
  // internas, así que la conversación es todavía más larga.
  const cuantosMensajes = await db.ticketMessage.count({
    where: { ticketId: ticket.id },
  });
  const pagina = paginar(
    cuantosMensajes,
    POR_PAGINA.mensajes,
    m === undefined ? ULTIMA : leerPagina(m),
  );

  const mensajes = await db.ticketMessage.findMany({
    where: { ticketId: ticket.id },
    orderBy: { createdAt: "asc" },
    skip: pagina.salta,
    take: pagina.toma,
    select: {
      id: true,
      body: true,
      interno: true,
      createdAt: true,
      author: { select: { id: true, username: true, avatar: true, role: true } },
      adjuntos: { select: { id: true, url: true, width: true, height: true } },
    },
  });

  const gente = componerParticipantes({
    autor: ticket.author,
    invitados: ticket.invitados.map((fila) => fila.user),
    autoresDeMensajes: mensajes.map((mensaje) => mensaje.author),
    // Quien tiene el ticket abierto ahora mismo, según su último latido.
    presentes: ticket.presencias
      .filter((presencia) => estaMirando(presencia.seenAt))
      .map((presencia) => presencia.user),
  });

  const categoria = getCategoriaTicket(ticket.category);
  const respuestas = (ticket.answers ?? {}) as Record<string, unknown>;
  const arriba = siguienteNivel(ticket.nivel);
  const abajo = nivelAnterior(ticket.nivel);

  // Contexto del autor: cuántos ha abierto, cuántos siguen vivos y cuáles son.
  // Un jugador con cinco tickets abiertos a la vez se lee distinto que uno que
  // escribe por primera vez.
  const [suyos, otrosAbiertos, otros] = await Promise.all([
    db.ticket.count({ where: { authorId: ticket.authorId } }),
    db.ticket.count({
      where: {
        authorId: ticket.authorId,
        id: { not: ticket.id },
        status: { not: "CERRADO" },
      },
    }),
    db.ticket.findMany({
      where: {
        authorId: ticket.authorId,
        id: { not: ticket.id },
        // Solo los que este escalón puede ver: el contexto no salta permisos.
        nivel: { in: NIVELES.slice(0, NIVELES.indexOf(staff.role) + 1) },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 5,
      select: {
        id: true,
        numero: true,
        subject: true,
        status: true,
        lastMessageAt: true,
      },
    }),
  ]);

  return (
    <div className="shell grid max-w-[62rem] gap-[var(--space-lg)] py-[var(--space-xl)]">
      <Link href="/panel/tickets" className="meta w-fit hover:text-[var(--color-ink)]">
        ← Tickets
      </Link>

      <header className="grid gap-[var(--space-sm)]">
        <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
          <span className="meta">#{ticket.numero}</span>
          <h1 className="display text-(length:--text-xl)">{ticket.subject}</h1>
          <NivelTicket nivel={ticket.nivel} />
          <EstadoTicket status={ticket.status} />
        </div>
        {/* Cada dato con su nombre encima: en una sola línea de meta gris no se
            distinguía la categoría del identificador de Discord. */}
        <dl className="fichas">
          <div>
            <dt className="meta">Categoría</dt>
            <dd>{categoria?.nombre ?? ticket.category}</dd>
          </div>
          <div>
            <dt className="meta">Abierto</dt>
            <dd>{formatearFechaHora(ticket.createdAt)}</dd>
          </div>
          <div>
            <dt className="meta">Último movimiento</dt>
            <dd>{hace(ticket.lastMessageAt)}</dd>
          </div>
          <div>
            <dt className="meta">Discord del autor</dt>
            <dd className="tabular-nums">{ticket.author.discordId}</dd>
          </div>
          <div>
            <dt className="meta">Tickets suyos</dt>
            <dd>
              {suyos}
              {otrosAbiertos > 0 ? ` · ${otrosAbiertos} sin cerrar` : ""}
            </dd>
          </div>
        </dl>

        <p className="text-sm text-[var(--color-muted)]">
          {explicaEstado(ticket.status, "staff")}
        </p>

        {/* Lo que dijo el autor de cómo se le atendió. Se enseña entero y con
            su fecha: una nota baja sin lo que la acompaña no sirve de nada. */}
        {ticket.valoracion !== null ? (
          <div className="tile grid gap-[var(--space-2xs)]">
            <span className="meta">
              Valoración del autor
              {ticket.valoradoAt ? ` · ${formatearFechaHora(ticket.valoradoAt)}` : ""}
            </span>
            <span className="display text-(length:--text-md)">
              {ticket.valoracion}/5
            </span>
            {ticket.valoracionNota ? (
              <p className="respuesta text-sm text-[var(--color-muted)]">
                {ticket.valoracionNota}
              </p>
            ) : null}
          </div>
        ) : null}
        <LatidoTicket id={ticket.id} />

      </header>

      <div className="grid gap-[var(--space-lg)] lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid content-start gap-[var(--space-lg)]">
          <Paginacion
            pagina={pagina}
            href={(numero) => `/panel/tickets/${ticket.id}?m=${numero}`}
            etiqueta="Páginas de la conversación"
          />

          <Conversacion
            mensajes={mensajes}
            verInternas
            datos={
              // El formulario cuelga del primer mensaje, que solo está en la
              // primera página.
              categoria && pagina.actual === 1 ? (
                <DatosTicket categoria={categoria} respuestas={respuestas} />
              ) : null
            }
          />

          {puedeEscribir(actor, vista) ? (
            <ResponderTicket id={ticket.id} puedeNotaInterna />
          ) : (
            <p className="tile text-sm text-[var(--color-muted)]">
              Cerrado. Para seguir hablando aquí hay que reabrirlo.
            </p>
          )}
        </div>

        <Participantes
          ticketId={ticket.id}
          gente={gente}
          puedeInvitar={puedeInvitar(actor, vista)}
          asignacion={{
            lleva: ticket.assignee ?? null,
            loLlevoYo: ticket.assigneeId === staff.id,
          }}
        />
      </div>

      {otros.length > 0 ? (
        <section className="grid gap-[var(--space-sm)]">
          <div className="section-head">
            <h2 className="display text-(length:--text-md)">
              Otros tickets de {ticket.author.username}
            </h2>
          </div>
          <ul className="grid gap-[var(--space-2xs)]">
            {otros.map((otro) => (
              <li
                key={otro.id}
                className="flex flex-wrap items-center gap-[var(--space-sm)]"
              >
                <Link
                  href={`/panel/tickets/${otro.id}`}
                  className="text-sm underline-offset-4 hover:underline"
                >
                  #{otro.numero} · {otro.subject}
                </Link>
                <EstadoTicket status={otro.status} />
                <span className="meta">{hace(otro.lastMessageAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Lo que se decide sobre el ticket, junto y al final. */}
      <section className="tile flex flex-wrap items-center justify-between gap-[var(--space-md)]">
        <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
          {arriba ? (
            <form
              action={async () => {
                "use server";
                await moverTicket(ticket.id, arriba);
              }}
            >
              <Boton type="submit">
                <ChevronUp size={15} aria-hidden />
                Subir a {NIVEL_TEXTO[arriba]?.toLowerCase() ?? arriba}
              </Boton>
            </form>
          ) : (
            <span className="meta">Ya está en el escalón más alto</span>
          )}

          {abajo ? (
            <form
              action={async () => {
                "use server";
                await moverTicket(ticket.id, abajo);
              }}
            >
              <Boton type="submit" variante="ghost">
                <ChevronDown size={15} aria-hidden />
                Devolver a {NIVEL_TEXTO[abajo]?.toLowerCase() ?? abajo}
              </Boton>
            </form>
          ) : null}
        </div>

        {puedeCerrar(actor, vista) ? (
          <form
            action={async () => {
              "use server";
              await cerrarTicket(ticket.id);
            }}
          >
            <Boton type="submit" variante="primary">
              Cerrar ticket
            </Boton>
          </form>
        ) : puedeReabrir(actor, vista) ? (
          <form
            action={async () => {
              "use server";
              await reabrirTicket(ticket.id);
            }}
          >
            <Boton type="submit">Reabrir</Boton>
          </form>
        ) : null}
      </section>
    </div>
  );
}
