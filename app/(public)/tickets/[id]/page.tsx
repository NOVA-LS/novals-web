import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CalendarDays, Tag } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/guards";
import { getCategoriaTicket } from "@/lib/tickets/categorias";
import {
  atiende,
  esAutor,
  esParte,
  puedeCerrar,
  puedeEscribir,
  puedeInvitar,
  puedeVer,
} from "@/lib/tickets/reglas";
import { componerParticipantes } from "@/lib/tickets/gente";
import { estaMirando } from "@/lib/tickets/presencia";
import { cerrarTicket } from "@/lib/actions/tickets";
import { formatearFechaHora } from "@/lib/utils";
import { leerPagina, paginar, POR_PAGINA, ULTIMA } from "@/lib/paginacion";
import { Boton, EnlaceBoton } from "@/components/ui/button";
import { Conversacion } from "@/components/tickets/conversacion";
import { Paginacion } from "@/components/ui/paginacion";
import { DatosTicket } from "@/components/tickets/datos-ticket";
import { EstadoTicket, explicaEstado } from "@/components/tickets/estado-ticket";
import { LatidoTicket } from "@/components/tickets/latido";
import { Participantes } from "@/components/tickets/participantes";
import { ResponderTicket } from "@/components/tickets/responder-ticket";
import { ValorarTicket } from "@/components/tickets/valorar-ticket";

export const metadata: Metadata = { title: "Ticket" };
export const dynamic = "force-dynamic";

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { id } = await params;
  const { m } = await searchParams;
  const usuario = await currentUser();

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
      valoracion: true,
      valoracionNota: true,
      author: {
        select: { id: true, username: true, avatar: true, role: true },
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
    },
  });

  const actor = usuario ? { id: usuario.id, role: usuario.role } : null;

  // Las reglas hablan de identificadores, no de tablas.
  const vista = ticket
    ? { ...ticket, invitados: ticket.invitados.map((fila) => fila.user.id) }
    : null;

  // Un ticket ajeno se comporta como si no existiera: ni confirmamos que está.
  if (!ticket || !vista || !puedeVer(actor, vista)) notFound();

  const categoria = getCategoriaTicket(ticket.category);
  const respuestas = (ticket.answers ?? {}) as Record<string, unknown>;
  // Un ticket propio se lee como propio aunque quien lo abriera sea del staff:
  // aquí es el jugador de ese ticket, con sus estados y sin las notas internas
  // que se escriben sobre él. Para atenderlo está el panel.
  const esStaff = !esParte(actor, vista) && atiende(actor, vista);
  const cerrado = ticket.status === "CERRADO";

  // La conversación va por páginas: un ticket largo con imágenes no se puede
  // cargar entero. Sin página pedida se entra por la última, que es donde está
  // lo último que se dijo.
  const dondeMensajes = { ticketId: ticket.id, ...(esStaff ? {} : { interno: false }) };
  const cuantosMensajes = await db.ticketMessage.count({ where: dondeMensajes });
  const pagina = paginar(
    cuantosMensajes,
    POR_PAGINA.mensajes,
    m === undefined ? ULTIMA : leerPagina(m),
  );

  const mensajes = await db.ticketMessage.findMany({
    where: dondeMensajes,
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

  return (
    <div className="shell grid max-w-[66rem] gap-[var(--space-xl)] py-[var(--space-2xl)]">
      <Link href="/tickets" className="enlace-volver w-fit">
        <ArrowLeft size={14} aria-hidden />
        Mis tickets
      </Link>

      <header className="grid gap-[var(--space-md)]">
        <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
          <span className="text-(length:--text-xl) text-[var(--color-muted)]">
            #{ticket.numero}
          </span>
          <h1 className="display text-(length:--text-xl)">{ticket.subject}</h1>
          <EstadoTicket status={ticket.status} vista={esStaff ? "staff" : "jugador"} />
        </div>

        {/* Categoría, fecha y qué significa el estado: el badge solo no basta. */}
        <div className="tile tile--suave inline-flex w-fit flex-wrap items-center gap-[var(--space-lg)]">
          <span className="flex items-center gap-[var(--space-2xs)] text-sm text-[var(--color-muted)]">
            <Tag size={14} aria-hidden />
            {categoria?.nombre ?? ticket.category}
          </span>
          <span className="flex items-center gap-[var(--space-2xs)] text-sm text-[var(--color-muted)]">
            <CalendarDays size={14} aria-hidden />
            Abierto · {formatearFechaHora(ticket.createdAt)}
          </span>
          <span className="text-sm text-[var(--color-ink)]">
            {explicaEstado(ticket.status, esStaff ? "staff" : "jugador")}
          </span>
        </div>
        <LatidoTicket id={ticket.id} />
      </header>

      <div className="grid gap-[var(--space-lg)] lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid content-start gap-[var(--space-lg)]">
          {/* Arriba y no abajo: lo que hay antes de esta página son mensajes
              más viejos, y es hacia arriba a donde se mira para buscarlos. */}
          <Paginacion
            pagina={pagina}
            href={(numero) => `/tickets/${ticket.id}?m=${numero}`}
            etiqueta="Páginas de la conversación"
          />

          <Conversacion
            mensajes={mensajes}
            verInternas={esStaff}
            datos={
              // El formulario cuelga del primer mensaje, que solo está en la
              // primera página.
              categoria && pagina.actual === 1 ? (
                <DatosTicket categoria={categoria} respuestas={respuestas} />
              ) : null
            }
          />

          {/* Lo primero que se ve al volver a un ticket cerrado. Con nota ya
              puesta sigue saliendo, pero de solo leer: la regla es la que decide
              si además se puede mandar. */}
          {cerrado && esAutor(actor, vista) ? (
            <ValorarTicket
              id={ticket.id}
              valoracion={ticket.valoracion}
              nota={ticket.valoracionNota}
            />
          ) : null}

          {/* Cerrado es cerrado: en vez de la caja de escribir, la salida. */}
          {puedeEscribir(actor, vista) ? (
            <ResponderTicket id={ticket.id} />
          ) : cerrado ? (
            <div className="tile tile--suave flex flex-wrap items-center justify-between gap-[var(--space-sm)]">
              <p className="text-sm text-[var(--color-muted)]">
                Este ticket está cerrado. Si te queda algo, abre otro.
              </p>
              <EnlaceBoton href="/tickets/nuevo" className="btn--redondo">
                Abrir otro
              </EnlaceBoton>
            </div>
          ) : null}

          {puedeCerrar(actor, vista) ? (
            <form
              action={async () => {
                "use server";
                await cerrarTicket(ticket.id);
              }}
              className="justify-self-start"
            >
              <Boton type="submit" className="btn--redondo">
                Dar por resuelto
              </Boton>
            </form>
          ) : null}
        </div>

        {/* Meter gente es atender el ticket, y aquí no se atiende: en el propio
            se es parte, y para lo demás está el panel. */}
        <Participantes
          ticketId={ticket.id}
          gente={gente}
          puedeInvitar={esStaff && puedeInvitar(actor, vista)}
        />
      </div>
    </div>
  );
}
