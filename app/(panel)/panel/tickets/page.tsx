import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { CATEGORIAS_TICKET, getCategoriaTicket } from "@/lib/tickets/categorias";
import { NIVELES } from "@/lib/tickets/reglas";
import { leerPagina, paginar, POR_PAGINA } from "@/lib/paginacion";
import { diasDesde } from "@/lib/stats";
import { hace } from "@/lib/utils";
import { EstadoTicket, NivelTicket } from "@/components/tickets/estado-ticket";
import { CabeceraPanel } from "@/components/panel/cabecera-panel";
import { Boton, EnlaceBoton } from "@/components/ui/button";
import { Paginacion } from "@/components/ui/paginacion";
import type { Prisma } from "@/generated/prisma/client";
import type { TicketStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Tickets" };
export const dynamic = "force-dynamic";

/** Días sin movimiento a partir de los cuales un ticket vivo canta. */
const DIAS_DE_ALARMA = 2;

/**
 * Las vistas de la bandeja.
 *
 * «Vivos» es la de salida y deja fuera los cerrados a propósito: un buzón de
 * soporte se mira para saber qué queda por hacer, y un cerrado de hace un mes
 * solo estorba. Los cerrados tienen su propia vista.
 */
const VISTAS = [
  { clave: "", texto: "Vivos" },
  { clave: "EN_CURSO", texto: "Nos toca" },
  { clave: "ABIERTO", texto: "Sin abrir" },
  { clave: "ESPERANDO", texto: "Con el jugador" },
  { clave: "sin-asignar", texto: "Sin dueño" },
  { clave: "CERRADO", texto: "Cerrados" },
] as const;

type ClaveVista = (typeof VISTAS)[number]["clave"];

function filtroDeVista(vista: ClaveVista): Prisma.TicketWhereInput {
  if (vista === "") return { status: { not: "CERRADO" } };
  if (vista === "sin-asignar") {
    return { status: { not: "CERRADO" }, assigneeId: null };
  }
  return { status: vista as TicketStatus };
}

export default async function PanelTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; categoria?: string; q?: string; p?: string }>;
}) {
  const staff = await requireUser("INICIADOR");
  const { vista, categoria, q, p } = await searchParams;

  // Solo se ve lo que llega al escalón propio: un iniciador no debe enterarse
  // de que existe un ticket de donaciones. Y no el suyo propio: si abrió uno
  // como jugador, no es él quien lo atiende.
  const alcanzo = NIVELES.slice(0, NIVELES.indexOf(staff.role) + 1);
  const alcance: Prisma.TicketWhereInput = {
    nivel: { in: alcanzo },
    authorId: { not: staff.id },
  };

  const laVista = (VISTAS.find((opcion) => opcion.clave === vista)?.clave ??
    "") as ClaveVista;
  const busqueda = (q ?? "").trim();
  const categoriaValida = getCategoriaTicket(categoria ?? "")?.clave;

  // Se busca por número o por texto: quien dice «el 42» y quien dice «el del
  // atropello» están buscando lo mismo de dos maneras.
  const numero = Number(busqueda);
  const filtroBusqueda: Prisma.TicketWhereInput | undefined = busqueda
    ? {
        OR: [
          ...(Number.isInteger(numero) && numero > 0 ? [{ numero }] : []),
          { subject: { contains: busqueda } },
          { author: { username: { contains: busqueda } } },
        ],
      }
    : undefined;

  const where: Prisma.TicketWhereInput = {
    ...alcance,
    ...filtroDeVista(laVista),
    ...(categoriaValida ? { category: categoriaValida } : {}),
    ...(filtroBusqueda ?? {}),
  };

  const total = await db.ticket.count({ where });
  const pagina = paginar(total, POR_PAGINA.tickets, leerPagina(p));

  // Base de las cuentas: el alcance y la categoría, pero no la vista, que es
  // justo lo que se elige con ellas.
  const base: Prisma.TicketWhereInput = {
    ...alcance,
    ...(categoriaValida ? { category: categoriaValida } : {}),
    ...(filtroBusqueda ?? {}),
  };

  const [tickets, porEstado, sinAsignar, vivos] = await Promise.all([
    db.ticket.findMany({
      where,
      // Lo más parado primero cuando el trabajo está por hacer; en los cerrados
      // interesa lo contrario, que lo último resuelto quede arriba.
      orderBy: { lastMessageAt: laVista === "CERRADO" ? "desc" : "asc" },
      skip: pagina.salta,
      take: pagina.toma,
      select: {
        id: true,
        numero: true,
        subject: true,
        category: true,
        status: true,
        nivel: true,
        lastMessageAt: true,
        author: { select: { username: true } },
        assignee: { select: { username: true } },
        _count: { select: { messages: true } },
      },
    }),
    db.ticket.groupBy({
      by: ["status"],
      where: base,
      _count: { _all: true },
    }),
    db.ticket.count({
      where: { ...base, status: { not: "CERRADO" }, assigneeId: null },
    }),
    db.ticket.count({ where: { ...base, status: { not: "CERRADO" } } }),
  ]);

  const cuenta = new Map(porEstado.map((fila) => [fila.status, fila._count._all]));
  const cuentaDe = (clave: ClaveVista) => {
    if (clave === "") return vivos;
    if (clave === "sin-asignar") return sinAsignar;
    return cuenta.get(clave as TicketStatus) ?? 0;
  };

  // Cambiar de vista o de categoría devuelve a la primera página; cambiar de
  // página conserva todo lo demás.
  const enlace = (cambios: {
    vista?: string;
    categoria?: string;
    numero?: number;
  }) => {
    const parametros = new URLSearchParams();
    const nuevaVista = cambios.vista ?? laVista;
    const nuevaCategoria = cambios.categoria ?? categoriaValida;
    if (nuevaVista) parametros.set("vista", nuevaVista);
    if (nuevaCategoria) parametros.set("categoria", nuevaCategoria);
    if (busqueda) parametros.set("q", busqueda);
    if (cambios.numero && cambios.numero > 1) {
      parametros.set("p", String(cambios.numero));
    }
    const cadena = parametros.toString();
    return cadena ? `/panel/tickets?${cadena}` : "/panel/tickets";
  };

  return (
    <div className="shell grid gap-[var(--space-lg)] py-[var(--space-xl)]">
      <CabeceraPanel
        titulo="Tickets"
        descripcion="Lo que llega por la web. Solo ves los de tu escalón para abajo."
        acciones={
          <form className="buscador">
            {/* Los filtros viajan con la búsqueda: buscar no debe deshacerlos. */}
            {laVista ? <input type="hidden" name="vista" value={laVista} /> : null}
            {categoriaValida ? (
              <input type="hidden" name="categoria" value={categoriaValida} />
            ) : null}
            <input
              name="q"
              defaultValue={busqueda}
              className="input"
              placeholder="Número, asunto o jugador…"
              aria-label="Buscar ticket"
            />
            <Boton type="submit">
              <Search size={15} aria-hidden />
              Buscar
            </Boton>
          </form>
        }
      />

      <div className="grid gap-[var(--space-xs)]">
        <div className="flex flex-wrap gap-[var(--space-xs)]">
          {VISTAS.map((opcion) => (
            <Link
              key={opcion.clave || "vivos"}
              href={enlace({ vista: opcion.clave })}
              className="chip"
              data-activo={laVista === opcion.clave}
            >
              {opcion.texto}
              <span className="chip__n">{cuentaDe(opcion.clave)}</span>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-[var(--space-xs)]">
          <Link
            href={enlace({ categoria: "" })}
            className="chip"
            data-activo={!categoriaValida}
          >
            Todas
          </Link>
          {CATEGORIAS_TICKET.filter((opcion) =>
            alcanzo.includes(opcion.nivel),
          ).map((opcion) => (
            <Link
              key={opcion.clave}
              href={enlace({ categoria: opcion.clave })}
              className="chip"
              data-activo={categoriaValida === opcion.clave}
            >
              {opcion.nombre}
            </Link>
          ))}
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="tile grid justify-items-start gap-[var(--space-sm)]">
          <p className="text-[var(--color-muted)]">
            {busqueda
              ? `Ningún ticket cuadra con «${busqueda}».`
              : "Nada por aquí. Buen momento para respirar."}
          </p>
          <EnlaceBoton href="/panel/tickets">Quitar los filtros</EnlaceBoton>
        </div>
      ) : (
        <ul className="grid gap-[var(--space-xs)]">
          {tickets.map((ticket) => {
            const parado = diasDesde(ticket.lastMessageAt);
            // Solo alarma lo que nos toca a nosotros: si la pelota está en el
            // tejado del jugador, que lleve días parado es normal.
            const urge =
              ticket.status !== "CERRADO" &&
              ticket.status !== "ESPERANDO" &&
              parado >= DIAS_DE_ALARMA;

            return (
              <li key={ticket.id}>
                <Link
                  href={`/panel/tickets/${ticket.id}`}
                  className="tile tile--link grid gap-[var(--space-2xs)] py-[var(--space-sm)]"
                >
                  <span className="flex flex-wrap items-center gap-[var(--space-sm)]">
                    <span className="meta">#{ticket.numero}</span>
                    <span className="min-w-0 flex-1 truncate">{ticket.subject}</span>
                    <NivelTicket nivel={ticket.nivel} />
                    <EstadoTicket status={ticket.status} />
                  </span>
                  <span className="meta">
                    {ticket.author.username} ·{" "}
                    {getCategoriaTicket(ticket.category)?.nombre ?? ticket.category} ·{" "}
                    {ticket._count.messages} mensaje(s) ·{" "}
                    <span
                      className={
                        urge ? "text-[var(--color-pending)]" : undefined
                      }
                    >
                      {hace(ticket.lastMessageAt)}
                    </span>
                    {ticket.assignee
                      ? ` · lo lleva ${ticket.assignee.username}`
                      : ticket.status !== "CERRADO"
                        ? " · sin dueño"
                        : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Paginacion
        pagina={pagina}
        href={(numero) => enlace({ numero })}
        etiqueta="Páginas de tickets"
      />
    </div>
  );
}
