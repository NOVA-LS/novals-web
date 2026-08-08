import Link from "next/link";
import type { Metadata } from "next";
import { RefreshCw, Search } from "lucide-react";
import { db } from "@/lib/db";
import { ESCALONES, requireUser } from "@/lib/guards";
import { cambiarEquipos, cambiarRol, traerRolesDeDiscord } from "@/lib/actions/admin";
import { formatearFecha } from "@/lib/utils";
import { leerPagina, paginar, POR_PAGINA } from "@/lib/paginacion";
import { Paginacion } from "@/components/ui/paginacion";
import { Avatar } from "@/components/ui/avatar";
import { Boton, EnlaceBoton } from "@/components/ui/button";
import { EtiquetasStaff } from "@/components/ui/etiqueta-staff";
import { EQUIPO_NOMBRE, EQUIPOS } from "@/lib/equipos";
import { CabeceraPanel } from "@/components/panel/cabecera-panel";
import type { Role, StaffTag } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Usuarios" };
export const dynamic = "force-dynamic";

const ROLES: Role[] = ["USER", ...ESCALONES];

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string }>;
}) {
  const admin = await requireUser("ADMIN");
  const { q, p } = await searchParams;
  const busqueda = (q ?? "").trim();

  // SQLite no distingue mayúsculas en `contains`, así que basta con esto.
  const donde = busqueda ? { username: { contains: busqueda } } : undefined;

  const cuantos = await db.user.count({ where: donde });
  const pagina = paginar(cuantos, POR_PAGINA.usuarios, leerPagina(p));

  const usuarios = await db.user.findMany({
    where: donde,
    orderBy: [{ role: "desc" }, { username: "asc" }],
    skip: pagina.salta,
    take: pagina.toma,
    select: {
      id: true,
      username: true,
      discordId: true,
      role: true,
      teams: { select: { tag: true } },
      avatar: true,
      createdAt: true,
      referredBy: { select: { id: true, username: true } },
      // Contexto para decidir un ascenso sin salir de aquí.
      _count: { select: { submissions: true, reviews: true, notes: true } },
    },
  });

  return (
    <div className="shell grid gap-[var(--space-lg)] py-[var(--space-xl)]">
      <CabeceraPanel
        titulo="Usuarios"
        descripcion={`${cuantos} en la ciudad. Quién es quién y quién entra al panel.`}
        acciones={
          <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
            {/* Los cambios hechos en Discord entran solos al iniciar sesión;
                esto es para traerlos todos de golpe tras una tanda de ascensos. */}
            <form
              action={async () => {
                "use server";
                await traerRolesDeDiscord();
              }}
            >
              <Boton type="submit">
                <RefreshCw size={15} aria-hidden />
                Traer de Discord
              </Boton>
            </form>

            <form className="buscador">
              <input
                name="q"
                defaultValue={busqueda}
                className="input"
                placeholder="Buscar por nombre…"
                aria-label="Buscar usuario"
              />
              <Boton type="submit">
                <Search size={15} aria-hidden />
                Buscar
              </Boton>
            </form>
          </div>
        }
      />

      {usuarios.length === 0 ? (
        <div className="tile grid justify-items-start gap-[var(--space-sm)]">
          <p className="text-[var(--color-muted)]">Nadie con ese nombre.</p>
          <EnlaceBoton href="/panel/usuarios">Ver a todos</EnlaceBoton>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-rule)] text-left">
                <th className="meta py-[var(--space-xs)]">Usuario</th>
                <th className="meta py-[var(--space-xs)]">Actividad</th>
                <th className="meta py-[var(--space-xs)]">Rol</th>
                <th className="meta py-[var(--space-xs)]">Equipo</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.id} className="border-b border-[var(--color-rule)]">
                  <td className="py-[var(--space-sm)]">
                    <div className="flex items-center gap-[var(--space-sm)]">
                      <Avatar
                        src={usuario.avatar}
                        nombre={usuario.username}
                        size={32}
                      />
                      <div className="grid">
                        <span className="flex items-center gap-[var(--space-xs)]">
                          <Link
                            href={`/u/${usuario.id}`}
                            className="hover:text-[var(--color-ink)]"
                          >
                            {usuario.username}
                          </Link>
                          <EtiquetasStaff
                            tags={usuario.teams.map((fila) => fila.tag)}
                            menudo
                          />
                        </span>
                        <span className="meta tabular-nums">{usuario.discordId}</span>
                        {usuario.referredBy ? (
                          <Link
                            href={`/u/${usuario.referredBy.id}`}
                            className="meta hover:text-[var(--color-ink)]"
                          >
                            Invitado por {usuario.referredBy.username}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="py-[var(--space-sm)] text-[var(--color-muted)]">
                    <div className="grid">
                      <span className="meta">
                        {usuario._count.submissions} enviadas ·{" "}
                        {usuario._count.reviews} revisadas
                      </span>
                      <span className="meta">
                        Desde {formatearFecha(usuario.createdAt)}
                        {usuario._count.notes > 0
                          ? ` · ${usuario._count.notes} nota(s)`
                          : ""}
                      </span>
                    </div>
                  </td>
                  <td className="py-[var(--space-sm)]">
                    <form
                      action={async (datos: FormData) => {
                        "use server";
                        await cambiarRol(usuario.id, datos.get("rol") as Role);
                      }}
                      className="flex items-center gap-[var(--space-xs)]"
                    >
                      <select
                        name="rol"
                        defaultValue={usuario.role}
                        className="input input--corto"
                        disabled={usuario.id === admin.id}
                      >
                        {ROLES.map((rol) => (
                          <option key={rol} value={rol}>
                            {rol}
                          </option>
                        ))}
                      </select>
                      <Boton type="submit" disabled={usuario.id === admin.id}>
                        Aplicar
                      </Boton>
                    </form>
                  </td>
                  <td className="py-[var(--space-sm)]">
                    {/* Los equipos no dan permisos, así que aquí sí puede uno
                        tocarse los suyos: no hay forma de dejarse fuera. Van con
                        casillas porque se llevan varios a la vez. */}
                    <form
                      action={async (datos: FormData) => {
                        "use server";
                        await cambiarEquipos(
                          usuario.id,
                          datos.getAll("equipos").map((valor) => valor as StaffTag),
                        );
                      }}
                      className="grid gap-[var(--space-xs)]"
                    >
                      <div className="equipos">
                        {EQUIPOS.map((equipo) => (
                          <label key={equipo} className="equipos__opcion">
                            <input
                              type="checkbox"
                              name="equipos"
                              value={equipo}
                              defaultChecked={usuario.teams.some(
                                (fila) => fila.tag === equipo,
                              )}
                              className="size-4 accent-[var(--color-ink)]"
                            />
                            {EQUIPO_NOMBRE[equipo]}
                          </label>
                        ))}
                      </div>
                      <Boton type="submit" className="justify-self-start">
                        Aplicar
                      </Boton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Paginacion
        pagina={pagina}
        href={(numero) => {
          const parametros = new URLSearchParams();
          if (busqueda) parametros.set("q", busqueda);
          if (numero > 1) parametros.set("p", String(numero));
          const query = parametros.toString();
          return query ? `/panel/usuarios?${query}` : "/panel/usuarios";
        }}
        etiqueta="Páginas de usuarios"
      />
    </div>
  );
}
