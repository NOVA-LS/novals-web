import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { RolStaff } from "@/components/ui/rol";
import type { Role } from "@/generated/prisma/enums";

export type AutorConInsignias = {
  id: string;
  username: string;
  avatar: string | null;
  role: Role;
  /** Claves de lib/insignias/catalogo.ts */
  badges: { slug: string }[];
};

/** Autor de un mensaje: quién es, qué se ha ganado y cómo llegar a su perfil. */
export function FirmaAutor({
  autor,
  fecha,
  size = 32,
}: {
  autor: AutorConInsignias;
  fecha: string;
  size?: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-[var(--space-sm)]">
      <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
        <Link
          href={`/u/${autor.id}`}
          className="flex items-center gap-[var(--space-xs)] hover:text-[var(--color-ink)]"
        >
          <Avatar src={autor.avatar} nombre={autor.username} size={size} />
          <span className="text-sm">{autor.username}</span>
        </Link>

        {/* Aquí solo importa si quien escribe es staff, no lo que se haya
            ganado por el camino: las insignias van en su perfil. */}
        <RolStaff rol={autor.role} />
      </div>

      <span className="meta flex items-center gap-[var(--space-2xs)]">
        <CalendarDays size={13} aria-hidden />
        {fecha}
      </span>
    </div>
  );
}
