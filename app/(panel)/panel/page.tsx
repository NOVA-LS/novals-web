import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  Award,
  ClipboardList,
  Images,
  Inbox,
  LifeBuoy,
  Newspaper,
  ScrollText,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { traerTitulos } from "@/lib/forms/registro";
import { getCategoria } from "@/lib/foro/categorias";
import { NIVELES } from "@/lib/tickets/reglas";
import { diasDesde, haceDias, notaMedia } from "@/lib/stats";
import { formatearFechaHora, hace } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { EstadoBadge } from "@/components/ui/badge";
import { EnlaceBoton } from "@/components/ui/button";
import { EstadoTicket, NivelTicket } from "@/components/tickets/estado-ticket";

export const metadata: Metadata = { title: "Resumen" };
export const dynamic = "force-dynamic";

type Acceso = {
  href: string;
  texto: string;
  nota: string;
  Icono: LucideIcon;
  soloAdmin?: boolean;
};

export default async function PanelResumenPage() {
  const usuario = await requireUser("INICIADOR");
  const [
    cola,
    ultimasResueltas,
    borradores,
    noticiasPublicadas,
    fotos,
    jugadores,
    insignias,
    ultimosHilos,
    configs,
    ticketsVivos,
    ticketsNuevos,
    ticketsNuestros,
    titulos,
    valoraciones,
    enCola,
  ] = await Promise.all([
    // Las ocho más viejas sin resolver: es lo que se pinta. Cuántas hay en total
    // lo dice `enCola`, que se cuenta aparte.
    db.submission.findMany({
      where: { status: { in: ["PENDING", "IN_REVIEW"] } },
      orderBy: { createdAt: "asc" },
      take: 8,
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        user: { select: { username: true, avatar: true } },
      },
    }),
    db.submission.findMany({
      where: { status: { in: ["ACCEPTED", "REJECTED"] }, resolvedAt: { not: null } },
      orderBy: { resolvedAt: "desc" },
      take: 5,
      select: {
        id: true,
        type: true,
        status: true,
        resolvedAt: true,
        user: { select: { username: true, avatar: true } },
        reviewer: { select: { username: true } },
      },
    }),
    db.post.count({ where: { published: false } }),
    db.post.count({ where: { published: true } }),
    db.photo.count(),
    db.user.count(),
    db.userBadge.count(),
    db.thread.findMany({
      orderBy: { lastReplyAt: "desc" },
      take: 5,
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        lastReplyAt: true,
        author: { select: { username: true, avatar: true } },
        _count: { select: { replies: true } },
      },
    }),
    db.formConfig.findMany(),
    // Solo los del escalón propio: la cifra tiene que cuadrar con la bandeja.
    db.ticket.count({
      where: {
        status: { not: "CERRADO" },
        nivel: { in: NIVELES.slice(0, NIVELES.indexOf(usuario.role) + 1) },
      },
    }),
    db.ticket.count({
      where: {
        status: "ABIERTO",
        nivel: { in: NIVELES.slice(0, NIVELES.indexOf(usuario.role) + 1) },
      },
    }),
    // Los que están en nuestro tejado, empezando por el más parado.
    db.ticket.findMany({
      where: {
        status: { in: ["ABIERTO", "EN_CURSO"] },
        nivel: { in: NIVELES.slice(0, NIVELES.indexOf(usuario.role) + 1) },
      },
      orderBy: { lastMessageAt: "asc" },
      take: 6,
      select: {
        id: true,
        numero: true,
        subject: true,
        status: true,
        nivel: true,
        lastMessageAt: true,
        author: { select: { username: true, avatar: true } },
        assignee: { select: { username: true } },
      },
    }),
    // Cómo se llama hoy cada formulario: el nombre se edita desde el panel.
    traerTitulos(),
    // Lo que opinan de la atención, de los últimos 30 días y solo de los
    // tickets que este escalón puede ver: con la media de siempre, un mal mes
    // queda enterrado bajo el histórico.
    db.ticket.aggregate({
      where: {
        valoradoAt: { gte: haceDias(30) },
        nivel: { in: NIVELES.slice(0, NIVELES.indexOf(usuario.role) + 1) },
      },
      _avg: { valoracion: true },
      _count: { valoracion: true },
    }),
    db.submission.count({ where: { status: { in: ["PENDING", "IN_REVIEW"] } } }),
  ]);

  const media = valoraciones._avg.valoracion;
  const cuantasValoraciones = valoraciones._count.valoracion;

  // La más vieja sin resolver es la que mide de verdad si la cola va al día.
  const masVieja = cola[0];
  const esperaDias = masVieja ? diasDesde(masVieja.createdAt) : 0;

  const cerrados = configs.filter((config) => !config.open).length;

  const ACCESOS: Acceso[] = [
    {
      href: "/panel/tickets",
      texto: "Tickets",
      nota:
        ticketsVivos === 0
          ? "Ninguno abierto"
          : `${ticketsVivos} vivo(s) · ${ticketsNuevos} sin abrir`,
      Icono: LifeBuoy,
    },
    {
      href: "/panel/solicitudes",
      texto: "Solicitudes",
      nota: `${enCola} sin resolver`,
      Icono: Inbox,
    },
    {
      href: "/panel/usuarios",
      texto: "Usuarios",
      nota: `${jugadores} en la ciudad · roles`,
      Icono: Users,
      soloAdmin: true,
    },
    {
      href: "/panel/noticias",
      texto: "Noticias",
      nota: `${noticiasPublicadas} publicadas · ${borradores} en borrador`,
      Icono: Newspaper,
      soloAdmin: true,
    },
    {
      href: "/panel/galeria",
      texto: "Galería",
      nota: `${fotos} fotos`,
      Icono: Images,
      soloAdmin: true,
    },
    {
      href: "/panel/formularios",
      texto: "Formularios",
      nota: cerrados === 0 ? "Todo abierto" : `${cerrados} cerrado(s)`,
      Icono: ClipboardList,
      soloAdmin: true,
    },
    {
      href: "/panel/valoraciones",
      texto: "Valoraciones",
      nota:
        cuantasValoraciones === 0
          ? "Nadie ha valorado todavía"
          : `${notaMedia(media)}/5 · ${cuantasValoraciones} en 30 días`,
      Icono: Star,
      soloAdmin: true,
    },
    {
      href: "/panel/insignias",
      texto: "Insignias",
      nota:
        insignias === 0
          ? "Aún no las ha ganado nadie"
          : `${insignias} repartida(s) · automáticas`,
      Icono: Award,
    },
    {
      href: "/panel/registro",
      texto: "Registro",
      nota: "Quién hizo qué y cuándo",
      Icono: ScrollText,
      soloAdmin: true,
    },
  ];

  return (
    <div className="shell grid gap-[var(--space-xl)] py-[var(--space-xl)]">
      <header className="grid gap-[var(--space-2xs)]">
        <h1 className="display text-(length:--text-xl)">Hola, {usuario.username}</h1>
        <p className="text-[var(--color-muted)]">
          {enCola === 0 && ticketsNuestros.length === 0
            ? "Nada pendiente. Buen momento para darse una vuelta por el foro."
            : [
                enCola > 0 ? `${enCola} solicitud(es) por resolver` : null,
                ticketsNuestros.length > 0
                  ? `${ticketsNuestros.length} ticket(s) en tu tejado`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
        </p>
      </header>

      {/* Aviso solo cuando de verdad hay algo que corregir. */}
      {esperaDias >= 3 ? (
        <div className="tile flex flex-wrap items-center gap-[var(--space-sm)] border-[var(--color-pending)]">
          <AlertTriangle size={18} className="text-[var(--color-pending)]" aria-hidden />
          <p className="text-sm">
            La solicitud más antigua lleva <strong>{esperaDias} día(s)</strong> sin
            respuesta.
          </p>
          <Link
            href={`/panel/solicitudes/${masVieja.id}`}
            className="btn btn--ghost ml-auto"
          >
            Abrirla
          </Link>
        </div>
      ) : null}

      <section className="grid gap-[var(--space-md)] sm:grid-cols-2 lg:grid-cols-3">
        {ACCESOS.filter(
          (acceso) => !acceso.soloAdmin || usuario.role === "ADMIN",
        ).map(({ href, texto, nota, Icono }) => (
          <Link key={href} href={href} className="tile grid content-start gap-[var(--space-xs)]">
            <Icono size={20} className="text-[var(--color-muted)]" aria-hidden />
            <h2 className="display text-(length:--text-md)">{texto}</h2>
            <span className="meta">{nota}</span>
          </Link>
        ))}
      </section>

      {/* Lo que hay que atender, en paralelo: son las dos bandejas y ninguna
          manda sobre la otra. */}
      <div className="grid gap-[var(--space-xl)] lg:grid-cols-2">
        <section className="grid content-start gap-[var(--space-md)]">
          <div className="section-head section-head--fila">
            <h2 className="display text-(length:--text-lg)">Tickets pendientes</h2>
            <EnlaceBoton href="/panel/tickets">Ver la bandeja</EnlaceBoton>
          </div>

          {ticketsNuestros.length === 0 ? (
            <p className="text-[var(--color-muted)]">
              Ninguno esperando respuesta nuestra.
            </p>
          ) : (
            <ul className="grid gap-[var(--space-xs)]">
              {ticketsNuestros.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/panel/tickets/${ticket.id}`}
                    className="tile tile--link grid gap-[var(--space-2xs)] py-[var(--space-sm)]"
                  >
                    <div className="flex items-center gap-[var(--space-sm)]">
                      <Avatar
                        src={ticket.author.avatar}
                        nombre={ticket.author.username}
                        size={26}
                      />
                      <span className="meta">#{ticket.numero}</span>
                      <span className="min-w-0 flex-1 truncate">{ticket.subject}</span>
                      <EstadoTicket status={ticket.status} />
                    </div>
                    {/* El escalón y quién lo lleva, en su propia línea: en media
                        pantalla no caben en la misma que el asunto. */}
                    <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
                      <NivelTicket nivel={ticket.nivel} />
                      <span className="meta">
                        {hace(ticket.lastMessageAt)}
                        {ticket.assignee ? ` · ${ticket.assignee.username}` : ""}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid content-start gap-[var(--space-md)]">
          <div className="section-head section-head--fila">
            <h2 className="display text-(length:--text-lg)">Solicitudes</h2>
            <EnlaceBoton href="/panel/solicitudes">Ver todas</EnlaceBoton>
          </div>

          {cola.length === 0 ? (
            <p className="text-[var(--color-muted)]">Nada pendiente.</p>
          ) : (
            <ul className="grid gap-[var(--space-xs)]">
              {cola.map((solicitud) => (
                <li key={solicitud.id}>
                  <Link
                    href={`/panel/solicitudes/${solicitud.id}`}
                    className="tile tile--link grid gap-[var(--space-2xs)] py-[var(--space-sm)]"
                  >
                    <div className="flex items-center gap-[var(--space-sm)]">
                      <Avatar
                        src={solicitud.user.avatar}
                        nombre={solicitud.user.username}
                        size={26}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {solicitud.user.username}
                      </span>
                      <EstadoBadge status={solicitud.status} />
                    </div>
                    <span className="meta">
                      {titulos.get(solicitud.type) ?? solicitud.type} ·{" "}
                      {formatearFechaHora(solicitud.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Y debajo, lo que ya pasó: se mira de vez en cuando, no se atiende. */}
      <div className="grid gap-[var(--space-xl)] lg:grid-cols-2">
        <section className="grid content-start gap-[var(--space-md)]">
          <div className="section-head">
            <h2 className="display text-(length:--text-lg)">Resueltas hace poco</h2>
          </div>

          {ultimasResueltas.length === 0 ? (
            <p className="text-[var(--color-muted)]">Todavía nada.</p>
          ) : (
            <ul className="grid gap-[var(--space-xs)]">
              {ultimasResueltas.map((solicitud) => (
                <li
                  key={solicitud.id}
                  className="tile grid gap-[var(--space-2xs)] py-[var(--space-sm)]"
                >
                  <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
                    <Avatar
                      src={solicitud.user.avatar}
                      nombre={solicitud.user.username}
                      size={24}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {solicitud.user.username}
                    </span>
                    <EstadoBadge status={solicitud.status} />
                  </div>
                  <span className="meta">
                    {titulos.get(solicitud.type) ?? solicitud.type}
                    {solicitud.reviewer ? ` · ${solicitud.reviewer.username}` : ""}
                    {solicitud.resolvedAt
                      ? ` · ${formatearFechaHora(solicitud.resolvedAt)}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid content-start gap-[var(--space-md)]">
          <div className="section-head">
            <h2 className="display text-(length:--text-lg)">Movimiento en el foro</h2>
          </div>

          {ultimosHilos.length === 0 ? (
            <p className="text-[var(--color-muted)]">Ningún hilo todavía.</p>
          ) : (
            <ul className="grid gap-[var(--space-xs)]">
              {ultimosHilos.map((hilo) => (
                <li key={hilo.id}>
                  <Link
                    href={`/foro/${hilo.category}/${hilo.slug}`}
                    className="tile tile--link grid gap-[var(--space-2xs)] py-[var(--space-sm)]"
                  >
                    <div className="flex items-center gap-[var(--space-sm)]">
                      <Avatar
                        src={hilo.author.avatar}
                        nombre={hilo.author.username}
                        size={24}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {hilo.title}
                      </span>
                    </div>
                    <span className="meta">
                      {getCategoria(hilo.category)?.nombre ?? hilo.category} ·{" "}
                      {hilo._count.replies} resp. ·{" "}
                      {formatearFechaHora(hilo.lastReplyAt)}
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
