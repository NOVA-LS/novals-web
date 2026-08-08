import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { RolStaff } from "@/components/ui/rol";
import { Insignia } from "@/components/ui/insignia";
import { getInsignia } from "@/lib/insignias/catalogo";
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
    <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
      <Link
        href={`/u/${autor.id}`}
        className="flex items-center gap-[var(--space-xs)] hover:text-[var(--color-ink)]"
      >
        <Avatar src={autor.avatar} nombre={autor.username} size={size} />
        <span className="text-sm">{autor.username}</span>
      </Link>

      {/* Delante de las insignias: saber si quien escribe es staff importa más
          que lo que se haya ganado por el camino. */}
      <RolStaff rol={autor.role} />

      {autor.badges.map(({ slug }) => {
        // Una clave que ya no está en el catálogo no se pinta: la insignia se
        // retiró y no hay nada que enseñar.
        const insignia = getInsignia(slug);
        if (!insignia) return null;

        return (
          <Insignia
            key={slug}
            nombre={insignia.nombre}
            icono={insignia.icono}
            descripcion={insignia.descripcion}
          />
        );
      })}

      <span className="meta">{fecha}</span>
    </div>
  );
}
