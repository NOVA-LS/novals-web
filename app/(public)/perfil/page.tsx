import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ExternalLink, FilePlus2, Users } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/guards";
import { traerTitulos } from "@/lib/forms/registro";
import { entrarConDiscord } from "@/lib/actions/auth";
import { formatearFechaHora, hace } from "@/lib/utils";
import { EstadoBadge } from "@/components/ui/badge";
import { Boton, EnlaceBoton } from "@/components/ui/button";
import { CabeceraPerfil } from "@/components/perfil/cabecera-perfil";
import { EstadoTicket } from "@/components/tickets/estado-ticket";

export const metadata: Metadata = { title: "Mi perfil" };
export const dynamic = "force-dynamic";

/** Cuántas solicitudes propias se enseñan, de la más reciente hacia atrás. */
const MAX_SOLICITUDES = 20;

export default async function PerfilPage() {
  const usuario = await currentUser();

  if (!usuario) {
    return (
      <div className="shell grid max-w-[40rem] gap-[var(--space-md)] py-[var(--space-3xl)]">
        <h1 className="display text-(length:--text-display-s)">Mi perfil</h1>
        <p className="text-[var(--color-muted)]">
          Entra con Discord para ver tus datos y el estado de tus solicitudes.
        </p>
        <form action={entrarConDiscord}>
          <input type="hidden" name="destino" value="/perfil" />
          <Boton variante="primary" type="submit">
            Entrar con Discord
          </Boton>
        </form>
      </div>
    );
  }

  const [solicitudes, cuenta, tickets, titulos] = await Promise.all([
    // Las últimas: son las que dicen en qué punto estás. Las viejas resueltas no
    // se consultan, y con los años se acumulan.
    db.submission.findMany({
      where: { userId: usuario.id },
      orderBy: { createdAt: "desc" },
      take: MAX_SOLICITUDES,
      select: {
        id: true,
        type: true,
        status: true,
        staffNote: true,
        createdAt: true,
        resolvedAt: true,
      },
    }),
    // Las insignias son cosa del foro y se enseñan en el perfil público: aquí
    // se viene a ver el estado de las solicitudes.
    db.user.findUnique({
      where: { id: usuario.id },
      select: { createdAt: true },
    }),
    // Los tickets vivos: para quien mira su perfil, una solicitud y un ticket
    // son lo mismo —cosas suyas pendientes con el staff— aunque por dentro no
    // se parezcan en nada.
    db.ticket.findMany({
      where: {
        status: { not: "CERRADO" },
        OR: [
          { authorId: usuario.id },
          { invitados: { some: { userId: usuario.id } } },
        ],
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
    // Cómo se llama cada formulario hoy: el nombre puede haber cambiado desde
    // que se envió la solicitud.
    traerTitulos(),
  ]);

  const tieneWhitelist = usuario.whitelisted;

  return (
    <div className="shell grid max-w-[62rem] gap-[var(--space-xl)] py-[var(--space-2xl)]">
      <CabeceraPerfil
        nombre={usuario.username}
        avatar={usuario.avatar}
        rol={usuario.role}
        equipos={usuario.equipos}
        desde={cuenta?.createdAt}
        whitelist={tieneWhitelist}
        discordId={usuario.discordId}
        insignias={[]}
        cifras={[]}
        acciones={
          <div className="grid gap-[var(--space-xs)]">
            <EnlaceBoton href={`/u/${usuario.id}`}>
              <ExternalLink size={15} aria-hidden />
              Perfil público
            </EnlaceBoton>
            <EnlaceBoton href="/perfil/invitaciones">
              <Users size={15} aria-hidden />
              Invitaciones
            </EnlaceBoton>
          </div>
        }
      />

      {tickets.length > 0 ? (
        <section className="grid gap-[var(--space-md)]">
          <div className="section-head section-head--fila">
            <h2 className="display text-(length:--text-lg)">Tickets abiertos</h2>
            <EnlaceBoton href="/tickets">
              Verlos todos
              <ArrowRight size={15} aria-hidden />
            </EnlaceBoton>
          </div>

          <ul className="grid gap-[var(--space-xs)]">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="tile tile--link grid gap-[var(--space-2xs)] py-[var(--space-sm)]"
                >
                  <span className="flex flex-wrap items-center gap-[var(--space-sm)]">
                    <span className="meta">#{ticket.numero}</span>
                    <span className="min-w-0 flex-1 truncate">{ticket.subject}</span>
                    <EstadoTicket status={ticket.status} vista="jugador" />
                  </span>
                  <span className="meta">{hace(ticket.lastMessageAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section id="solicitudes" className="grid gap-[var(--space-md)] scroll-mt-24">
        <div className="section-head section-head--fila">
          <h2 className="display text-(length:--text-lg)">Mis solicitudes</h2>
          <EnlaceBoton href="/formularios">
            Enviar otra
            <ArrowRight size={15} aria-hidden />
          </EnlaceBoton>
        </div>

        {solicitudes.length === 0 ? (
          <div className="tile grid justify-items-start gap-[var(--space-sm)]">
            <p className="text-[var(--color-muted)]">
              Todavía no has enviado ninguna.
            </p>
            <EnlaceBoton href="/formularios" variante="primary">
              <FilePlus2 size={15} aria-hidden />
              Ver formularios
            </EnlaceBoton>
          </div>
        ) : (
          <ul className="grid gap-[var(--space-sm)]">
            {solicitudes.map((solicitud) => {
              return (
                <li
                  key={solicitud.id}
                  data-estado={solicitud.status}
                  className="tile solicitud grid gap-[var(--space-sm)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-[var(--space-sm)]">
                    <h3 className="display text-(length:--text-md)">
                      {titulos.get(solicitud.type) ?? solicitud.type}
                    </h3>
                    <EstadoBadge status={solicitud.status} />
                  </div>

                  <dl className="fechas">
                    <div>
                      <dt className="meta">Enviada</dt>
                      <dd className="text-sm tabular-nums">
                        {formatearFechaHora(solicitud.createdAt)}
                      </dd>
                    </div>
                    {solicitud.resolvedAt ? (
                      <div>
                        <dt className="meta">Resuelta</dt>
                        <dd className="text-sm tabular-nums">
                          {formatearFechaHora(solicitud.resolvedAt)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {solicitud.staffNote ? (
                    <div className="nota-staff">
                      <span className="meta">
                        {solicitud.status === "REJECTED"
                          ? "Motivo del rechazo"
                          : "Respuesta del staff"}
                      </span>
                      <p className="respuesta text-sm text-[var(--color-muted)]">
                        {solicitud.staffNote}
                      </p>
                    </div>
                  ) : null}

                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
