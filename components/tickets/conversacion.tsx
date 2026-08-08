import Image from "next/image";
import Link from "next/link";
import { EyeOff } from "lucide-react";
import { renderMarkdown } from "@/lib/markdown";
import { formatearFechaHora } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { RolStaff } from "@/components/ui/rol";
import type { Role } from "@/generated/prisma/enums";

export type MensajeTicket = {
  id: string;
  body: string;
  interno: boolean;
  createdAt: Date;
  author: {
    id: string;
    username: string;
    avatar: string | null;
    role: Role;
  };
  adjuntos: { id: string; url: string; width: number; height: number }[];
};

/**
 * La conversación de un ticket.
 *
 * Las notas internas se filtran aquí dentro y no en la consulta a propósito: así
 * la pantalla del jugador y la del staff comparten la misma consulta y solo
 * cambia un booleano. Quien no las puede ver, no las recibe.
 */
export function Conversacion({
  mensajes,
  verInternas = false,
  datos,
}: {
  mensajes: MensajeTicket[];
  verInternas?: boolean;
  /** Las respuestas del formulario. Van dentro del mensaje que abrió el ticket. */
  datos?: React.ReactNode;
}) {
  const visibles = verInternas
    ? mensajes
    : mensajes.filter((mensaje) => !mensaje.interno);

  // El que abrió el ticket, que es el que lleva los datos del formulario. Nunca
  // es una nota interna, así que filtrar no lo mueve de sitio.
  const primero = mensajes[0]?.id;

  return (
    <ul className="grid gap-[var(--space-md)]">
      {visibles.map((mensaje) => (
        <li
          key={mensaje.id}
          id={`m-${mensaje.id}`}
          className="tile grid gap-[var(--space-sm)] scroll-mt-24"
          data-interno={mensaje.interno || undefined}
        >
          <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
            <Link
              href={`/u/${mensaje.author.id}`}
              className="flex items-center gap-[var(--space-xs)] hover:text-[var(--color-ink)]"
            >
              <Avatar
                src={mensaje.author.avatar}
                nombre={mensaje.author.username}
                size={28}
              />
              <span className="text-sm">{mensaje.author.username}</span>
            </Link>

            <RolStaff rol={mensaje.author.role} />

            {mensaje.interno ? (
              <span className="meta flex items-center gap-[var(--space-2xs)]">
                <EyeOff size={13} aria-hidden />
                Nota interna
              </span>
            ) : null}

            <span className="meta">{formatearFechaHora(mensaje.createdAt)}</span>
          </div>

          {datos && mensaje.id === primero ? datos : null}

          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(mensaje.body) }}
          />

          {mensaje.adjuntos.length > 0 ? (
            <ul className="flex flex-wrap gap-[var(--space-sm)]">
              {mensaje.adjuntos.map((adjunto) => (
                <li key={adjunto.id}>
                  {/* A tamaño completo en pestaña aparte: una prueba se mira de
                      cerca, y aquí solo cabe la miniatura. */}
                  <a href={adjunto.url} target="_blank" rel="noreferrer noopener">
                    <Image
                      src={adjunto.url}
                      alt="Captura adjunta"
                      width={adjunto.width}
                      height={adjunto.height}
                      sizes="200px"
                      className="h-28 w-auto rounded-[var(--radius-sm)] object-cover"
                    />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
