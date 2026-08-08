import Link from "next/link";
import { Hand, UserMinus, UserPlus, UserRoundX } from "lucide-react";
import { asignarTicket, invitarAlTicket, sacarDelTicket } from "@/lib/actions/tickets";
import { Avatar } from "@/components/ui/avatar";
import { Boton } from "@/components/ui/button";
import { Pista } from "@/components/ui/pista";
import { RolStaff } from "@/components/ui/rol";
import type { Role } from "@/generated/prisma/enums";

export type Participante = {
  id: string;
  username: string;
  avatar: string | null;
  role: Role;
  /** Cómo entró en el ticket. */
  papel: "autor" | "invitado" | "staff";
  /** Tiene el ticket abierto ahora mismo. */
  mirando: boolean;
};

const PAPEL = {
  autor: "Abrió el ticket",
  invitado: "Metido en la conversación",
  staff: "Atendiendo",
} as const;

/**
 * Quién está dentro del ticket.
 *
 * Se enseña a un lado y no dentro de la conversación porque responde a otra
 * pregunta: no «quién dijo qué» sino «quién está leyendo esto». En un reporte
 * entre varios eso es lo primero que se mira.
 *
 * Van en dos grupos, jugadores y staff, porque no son lo mismo: uno cuenta lo
 * que pasó y el otro decide, y mezclarlos obliga a leer el rol de cada línea
 * para saber con quién se está hablando.
 */
export function Participantes({
  ticketId,
  gente,
  puedeInvitar = false,
  asignacion,
}: {
  ticketId: string;
  gente: Participante[];
  puedeInvitar?: boolean;
  /** Solo en el panel: quién lo lleva y el botón de tomarlo. */
  asignacion?: {
    lleva: { username: string; avatar: string | null } | null;
    loLlevoYo: boolean;
  };
}) {
  const jugadores = gente.filter((persona) => persona.papel !== "staff");
  const staff = gente.filter((persona) => persona.papel === "staff");

  function fila(persona: Participante) {
    return (
      <li key={persona.id} className="flex items-center gap-[var(--space-xs)]">
        <Link
          href={`/u/${persona.id}`}
          className="flex min-w-0 flex-1 items-center gap-[var(--space-xs)] hover:text-[var(--color-ink)]"
        >
          <Avatar src={persona.avatar} nombre={persona.username} size={28} />
          <span className="grid min-w-0 gap-[0.1rem]">
            <span className="flex items-center gap-[var(--space-2xs)]">
              {/* Delante del nombre: la vista baja por esa columna, así que
                  quién está se ve de un barrido sin leer nada. */}
              {persona.mirando ? (
                <Pista
                  texto={`${persona.username} está mirándolo ahora`}
                  lado="arriba"
                >
                  <span className="mirando" />
                </Pista>
              ) : null}
              <span className="truncate text-sm">{persona.username}</span>
              <RolStaff rol={persona.role} />
            </span>
            <span className="meta">{PAPEL[persona.papel]}</span>
          </span>
        </Link>

        {/* Al autor no se le puede echar de su propio ticket, y al staff no se
            le mete ni se le saca: entra por su escalón. */}
        {puedeInvitar && persona.papel === "invitado" ? (
          <form
            action={async () => {
              "use server";
              await sacarDelTicket(ticketId, persona.id);
            }}
          >
            <button
              type="submit"
              className="meta"
              aria-label={`Sacar a ${persona.username}`}
            >
              <UserMinus size={15} aria-hidden />
            </button>
          </form>
        ) : null}
      </li>
    );
  }

  return (
    <aside className="tile grid content-start gap-[var(--space-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-sm)]">
        <h2 className="display text-(length:--text-md)">En este ticket</h2>

        {/* Tomarlo no cierra nada: cualquiera del escalón sigue pudiendo
            responder. Solo evita que dos contesten a la vez lo mismo. */}
        {asignacion ? (
          <form
            action={async () => {
              "use server";
              await asignarTicket(ticketId, !asignacion.loLlevoYo);
            }}
          >
            <Boton
              type="submit"
              variante={asignacion.loLlevoYo ? "ghost" : "outline"}
            >
              <Hand size={15} aria-hidden />
              {asignacion.loLlevoYo ? "Soltarlo" : "Tomarlo"}
            </Boton>
          </form>
        ) : null}
      </div>

      {/* Quién lo lleva es lo primero que se mira antes de ponerse a contestar,
          así que no puede ser una línea gris más: cuando no lo lleva nadie, se
          avisa en ámbar, que es un trabajo sin dueño. */}
      {asignacion ? (
        asignacion.lleva ? (
          <p className="dueno">
            <Avatar
              src={asignacion.lleva.avatar}
              nombre={asignacion.lleva.username}
              size={24}
            />
            {/* La frase entera en un solo hijo: si el nombre va suelto, el hueco
                del flex se suma al espacio que ya trae el texto. */}
            <span>
              Lo lleva <strong>{asignacion.lleva.username}</strong>
            </span>
          </p>
        ) : (
          <p className="dueno dueno--libre">
            <UserRoundX size={16} aria-hidden />
            Nadie lo ha cogido
          </p>
        )
      ) : null}

      {/* El staff primero: es quien resuelve, y a quien se busca al abrir un
          ticket para saber si hay alguien al otro lado. */}
      {staff.length > 0 ? (
        <div className="grid gap-[var(--space-xs)]">
          <span className="meta grupo-gente">Staff</span>
          <ul className="grid gap-[var(--space-sm)]">{staff.map(fila)}</ul>
        </div>
      ) : null}

      <div className="grid gap-[var(--space-xs)]">
        <span className="meta grupo-gente">Jugadores</span>
        <ul className="grid gap-[var(--space-sm)]">{jugadores.map(fila)}</ul>
      </div>

      {puedeInvitar ? (
        <form
          action={async (datos: FormData) => {
            "use server";
            await invitarAlTicket(ticketId, String(datos.get("nombre") ?? ""));
          }}
          className="grid gap-[var(--space-xs)]"
        >
          <label className="meta" htmlFor="invitar">
            Agregar nuevo miembro (ID de Discord)
          </label>
          <div className="flex items-center gap-[var(--space-xs)]">
            <input
              id="invitar"
              name="nombre"
              className="input"
              inputMode="numeric"
              placeholder="123…, 456…"
              aria-label="Identificadores de Discord, separados por comas"
            />
            <Boton type="submit">
              <UserPlus size={15} aria-hidden />
            </Boton>
          </div>
        </form>
      ) : null}
    </aside>
  );
}
