import { ShieldCheck } from "lucide-react";
import { formatearFecha } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EtiquetasStaff } from "@/components/ui/etiqueta-staff";
import { Insignia } from "@/components/ui/insignia";
import { getInsignia } from "@/lib/insignias/catalogo";
import { ROL_TEXTO } from "@/lib/roles";
import { Pista } from "@/components/ui/pista";
import type { Role, StaffTag } from "@/generated/prisma/enums";

export type InsigniaLlevada = {
  /** Clave de lib/insignias/catalogo.ts */
  slug: string;
};

export type CifraPerfil = { valor: number | string; etiqueta: string };

/**
 * Ficha de cabecera de un perfil.
 *
 * La comparten el perfil propio y el público para que la misma persona se vea
 * igual en los dos sitios: lo único que cambia son las cifras y los botones.
 */
export function CabeceraPerfil({
  nombre,
  avatar,
  rol,
  equipos = [],
  desde,
  whitelist = false,
  discordId,
  insignias,
  cifras,
  acciones,
  titulo = "h1",
}: {
  nombre: string;
  avatar: string | null;
  rol: Role;
  /** Equipos en los que trabaja, si es staff. Acompañan al rol, no lo sustituyen. */
  equipos?: StaffTag[];
  desde?: Date;
  whitelist?: boolean;
  /** Solo se pasa cuando quien mira tiene derecho a verlo. */
  discordId?: string;
  insignias: InsigniaLlevada[];
  cifras: CifraPerfil[];
  acciones?: React.ReactNode;
  titulo?: "h1" | "h2";
}) {
  const Titulo = titulo;

  return (
    <header className="tile perfil">
      {/* El identificador de Discord no ocupa una línea entera: se enseña al
          posar el ratón sobre el retrato, que es donde se va a buscar. */}
      {discordId ? (
        <Pista texto={`Discord · ${discordId}`} lado="arriba" redonda>
          <Avatar
            src={avatar}
            nombre={nombre}
            size={96}
            className="perfil__avatar"
            prioridad
          />
        </Pista>
      ) : (
        <Avatar src={avatar} nombre={nombre} size={96} className="perfil__avatar" prioridad />
      )}

      <div className="grid min-w-0 gap-[var(--space-sm)]">
        <div className="grid gap-[var(--space-xs)]">
          <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
            <Titulo className="display text-(length:--text-xl)">{nombre}</Titulo>
            <Badge tono={rol === "USER" ? "neutral" : "review"}>
              {rol !== "USER" ? <ShieldCheck size={13} aria-hidden /> : null}
              {ROL_TEXTO[rol]}
            </Badge>
            <EtiquetasStaff tags={equipos} />
            {whitelist ? <Badge tono="accepted">Whitelist</Badge> : null}
          </div>

          {desde ? (
            <span className="meta">Desde el {formatearFecha(desde)}</span>
          ) : null}
        </div>

        {/* Sin insignias no se anuncia el hueco: quien no las tiene no necesita
            que se lo recuerden, y el perfil propio ni siquiera las pide. */}
        {insignias.length > 0 ? (
          <div className="flex flex-wrap gap-[var(--space-xs)]">
            {insignias.map((llevada) => {
              const insignia = getInsignia(llevada.slug);
              if (!insignia) return null;

              // Solo qué es, no desde cuándo: la fecha es cosa suya y la tiene
              // en su propia página de insignias.
              return (
                <Insignia
                  key={llevada.slug}
                  nombre={insignia.nombre}
                  icono={insignia.icono}
                  descripcion={insignia.descripcion}
                />
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="perfil__lado">
        {cifras.length > 0 ? (
          <dl className="cifras">
            {cifras.map((cifra) => (
              <div key={cifra.etiqueta}>
                <dt className="meta order-2">{cifra.etiqueta}</dt>
                <dd className="order-1 display text-(length:--text-2xl) tabular-nums">
                  {cifra.valor}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {acciones ? (
          <div className="flex flex-wrap gap-[var(--space-xs)]">{acciones}</div>
        ) : null}
      </div>
    </header>
  );
}
