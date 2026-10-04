import "server-only";
import { db } from "@/lib/db";
import { encuestaAbierta } from "@/lib/encuesta";
import { formatearFechaHora } from "@/lib/utils";

/**
 * Lo que cambia con cada visita —votos, voto propio, apoyos—. Va aparte de
 * `noticiaPorSlug` y sin caché: cachearlo serviría a todos el voto del primero
 * que llegó y los contadores tardarían en moverse.
 */

export type EstadoEncuesta = {
  id: string;
  question: string | null;
  /** Ya formateada aquí: el navegador y el servidor no comparten zona horaria. */
  cierraEl: string | null;
  abierta: boolean;
  opciones: { id: string; label: string; votos: number }[];
  /** Id de la opción que votó quien mira, si votó. */
  miVoto: string | null;
};

export type EstadoInteraccion = {
  encuesta: EstadoEncuesta | null;
  apoyos: number;
  apoyado: boolean;
};

export async function estadoInteraccion(
  postId: string,
  userId: string | null,
): Promise<EstadoInteraccion> {
  const [poll, apoyos, apoyo] = await Promise.all([
    db.postPoll.findUnique({
      where: { postId },
      select: {
        id: true,
        question: true,
        closesAt: true,
        options: {
          orderBy: { position: "asc" },
          select: { id: true, label: true, _count: { select: { votes: true } } },
        },
      },
    }),
    db.postSupport.count({ where: { postId } }),
    userId
      ? db.postSupport.findUnique({
          where: { postId_userId: { postId, userId } },
          select: { id: true },
        })
      : null,
  ]);

  let encuesta: EstadoEncuesta | null = null;
  if (poll) {
    const voto = userId
      ? await db.pollVote.findUnique({
          where: { pollId_userId: { pollId: poll.id, userId } },
          select: { optionId: true },
        })
      : null;

    encuesta = {
      id: poll.id,
      question: poll.question,
      cierraEl: poll.closesAt ? formatearFechaHora(poll.closesAt) : null,
      abierta: encuestaAbierta(poll),
      opciones: poll.options.map((opcion) => ({
        id: opcion.id,
        label: opcion.label,
        votos: opcion._count.votes,
      })),
      miVoto: voto?.optionId ?? null,
    };
  }

  return { encuesta, apoyos, apoyado: apoyo !== null };
}
