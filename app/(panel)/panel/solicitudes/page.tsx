import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { traerFormularios } from "@/lib/forms/registro";
import { diasDesde } from "@/lib/stats";
import { cn, formatearFechaHora } from "@/lib/utils";
import { leerPagina, paginar, POR_PAGINA } from "@/lib/paginacion";
import { Paginacion } from "@/components/ui/paginacion";
import { Avatar } from "@/components/ui/avatar";
import { Boton, EnlaceBoton } from "@/components/ui/button";
import { EstadoBadge, ESTADO_TEXTO } from "@/components/ui/badge";
import { CabeceraPanel } from "@/components/panel/cabecera-panel";
import type { Status } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Solicitudes" };
export const dynamic = "force-dynamic";

const ESTADOS: Status[] = ["PENDING", "IN_REVIEW", "ACCEPTED", "REJECTED"];

/** A partir de aquí una solicitud sin resolver deja de ser normal. */
const DIAS_DE_ALARMA = 3;

export default async function BandejaPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; estado?: string; q?: string; p?: string }>;
}) {
  await requireUser("INICIADOR");
  const { tipo, estado, q, p } = await searchParams;

  const filtroEstado = ESTADOS.includes(estado as Status)
    ? (estado as Status)
    : undefined;
  const formularios = await traerFormularios();
  const titulos = new Map(formularios.map((form) => [form.type, form.title]));

  const filtroTipo = tipo && titulos.has(tipo) ? tipo : undefined;
  const busqueda = (q ?? "").trim();

  // SQLite no distingue mayúsculas en `contains`, así que basta con esto.
  const donde = {
    type: filtroTipo,
    status: filtroEstado,
    user: busqueda ? { username: { contains: busqueda } } : undefined,
  };

  // Cuántas hay con estos filtros decide en qué página cae la pedida.
  const cuantas = await db.submission.count({ where: donde });
  const pagina = paginar(cuantas, POR_PAGINA.solicitudes, leerPagina(p));

  const [solicitudes, conteos] = await Promise.all([
    db.submission.findMany({
      where: donde,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: pagina.salta,
      take: pagina.toma,
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        user: { select: { username: true, avatar: true } },
        reviewer: { select: { username: true } },
      },
    }),
    // Los mismos filtros menos el de estado: el contador de cada pestaña tiene
    // que decir cuántas hay ahí, no cuántas quedan tras haberla elegido.
    db.submission.groupBy({
      by: ["status"],
      where: { type: filtroTipo, user: donde.user },
      _count: { _all: true },
    }),
  ]);

  const porEstado = new Map(conteos.map((fila) => [fila.status, fila._count._all]));
  const total = conteos.reduce((suma, fila) => suma + fila._count._all, 0);

  const enlaceFiltro = (clave: "tipo" | "estado", valor?: string) => {
    const parametros = new URLSearchParams();
    if (busqueda) parametros.set("q", busqueda);

    if (clave === "tipo") {
      if (valor) parametros.set("tipo", valor);
      if (filtroEstado) parametros.set("estado", filtroEstado);
    } else {
      if (filtroTipo) parametros.set("tipo", filtroTipo);
      if (valor) parametros.set("estado", valor);
    }

    const query = parametros.toString();
    return query ? `/panel/solicitudes?${query}` : "/panel/solicitudes";
  };

  /** El mismo sitio, otra página: los filtros viajan con ella. */
  const enlacePagina = (numero: number) => {
    const parametros = new URLSearchParams();
    if (busqueda) parametros.set("q", busqueda);
    if (filtroTipo) parametros.set("tipo", filtroTipo);
    if (filtroEstado) parametros.set("estado", filtroEstado);
    if (numero > 1) parametros.set("p", String(numero));

    const query = parametros.toString();
    return query ? `/panel/solicitudes?${query}` : "/panel/solicitudes";
  };

  return (
    <div className="shell grid gap-[var(--space-lg)] py-[var(--space-xl)]">
      <CabeceraPanel
        titulo="Solicitudes"
        descripcion={`${cuantas} con estos filtros, de ${total} en total.`}
      />

      <div className="grid gap-[var(--space-sm)]">
        <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
          <span className="meta w-14">Tipo</span>
          <Link
            href={enlaceFiltro("tipo")}
            className="chip"
            data-activo={!filtroTipo}
          >
            Todos
          </Link>
          {formularios.map((form) => (
            <Link
              key={form.type}
              href={enlaceFiltro("tipo", form.type)}
              className="chip"
              data-activo={filtroTipo === form.type}
            >
              {form.title}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
          <span className="meta w-14">Estado</span>
          <Link
            href={enlaceFiltro("estado")}
            className="chip"
            data-activo={!filtroEstado}
          >
            Todos
            <span className="chip__n">{total}</span>
          </Link>
          {ESTADOS.map((valor) => (
            <Link
              key={valor}
              href={enlaceFiltro("estado", valor)}
              className="chip"
              data-activo={filtroEstado === valor}
            >
              {ESTADO_TEXTO[valor].texto}
              <span className="chip__n">{porEstado.get(valor) ?? 0}</span>
            </Link>
          ))}
        </div>

        {/* Con doscientas en la lista, buscar por nombre es más rápido que mirar. */}
        <form className="buscador flex-wrap">
          <span className="meta w-14">Nombre</span>
          {filtroTipo ? <input type="hidden" name="tipo" value={filtroTipo} /> : null}
          {filtroEstado ? (
            <input type="hidden" name="estado" value={filtroEstado} />
          ) : null}
          <input
            name="q"
            defaultValue={busqueda}
            className="input"
            placeholder="Buscar solicitante…"
            aria-label="Buscar por nombre"
          />
          <Boton type="submit">
            <Search size={15} aria-hidden />
            Buscar
          </Boton>
          {busqueda ? (
            <Link href={enlaceFiltro("estado", filtroEstado)} className="nav-link">
              Quitar
            </Link>
          ) : null}
        </form>
      </div>

      {solicitudes.length === 0 ? (
        <div className="tile grid justify-items-start gap-[var(--space-sm)]">
          <p className="text-[var(--color-muted)]">Nada por aquí con esos filtros.</p>
          {filtroTipo || filtroEstado || busqueda ? (
            <EnlaceBoton href="/panel/solicitudes">Quitar los filtros</EnlaceBoton>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-rule)] text-left">
                <th className="meta py-[var(--space-xs)]">Solicitante</th>
                <th className="meta py-[var(--space-xs)]">Tipo</th>
                <th className="meta py-[var(--space-xs)]">Estado</th>
                <th className="meta py-[var(--space-xs)]">Enviada</th>
                <th className="meta py-[var(--space-xs)]">Revisor</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((solicitud) => {
                const sinResolver =
                  solicitud.status === "PENDING" || solicitud.status === "IN_REVIEW";
                const dias = diasDesde(solicitud.createdAt);
                const vieja = sinResolver && dias >= DIAS_DE_ALARMA;

                return (
                  <tr key={solicitud.id} className="fila">
                    <td className="py-[var(--space-sm)]">
                      <Link
                        href={`/panel/solicitudes/${solicitud.id}`}
                        className="fila__enlace flex items-center gap-[var(--space-xs)]"
                      >
                        <Avatar
                          src={solicitud.user.avatar}
                          nombre={solicitud.user.username}
                          size={24}
                        />
                        {solicitud.user.username}
                      </Link>
                    </td>
                    <td className="py-[var(--space-sm)] text-[var(--color-muted)]">
                      {titulos.get(solicitud.type) ?? solicitud.type}
                    </td>
                    <td className="py-[var(--space-sm)]">
                      <EstadoBadge status={solicitud.status} />
                    </td>
                    <td className="py-[var(--space-sm)] tabular-nums">
                      <span
                        className={cn(
                          vieja ? "text-[var(--color-pending)]" : "text-[var(--color-muted)]",
                        )}
                      >
                        {formatearFechaHora(solicitud.createdAt)}
                      </span>
                      {sinResolver ? (
                        <span className="meta block">
                          {dias === 0 ? "hoy" : `hace ${dias} día(s)`}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-[var(--space-sm)] text-[var(--color-muted)]">
                      {solicitud.reviewer?.username ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Paginacion
        pagina={pagina}
        href={enlacePagina}
        etiqueta="Páginas de solicitudes"
      />
    </div>
  );
}
