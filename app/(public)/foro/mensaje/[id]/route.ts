import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { paginaDe, POR_PAGINA } from "@/lib/paginacion";

export const dynamic = "force-dynamic";

/**
 * Enlace directo a un mensaje suelto.
 *
 * Desde un perfil se enlaza un mensaje concreto, pero con el hilo repartido en
 * páginas el ancla `#m-…` solo funciona si además se acierta la página. Quién
 * está en cuál solo lo sabe el servidor, así que se calcula aquí y se redirige.
 */
export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const mensaje = await db.reply.findUnique({
    where: { id },
    select: {
      threadId: true,
      createdAt: true,
      thread: { select: { slug: true, category: true } },
    },
  });
  if (!mensaje) notFound();

  // El hilo se lee de más antiguo a más nuevo: los anteriores son su posición.
  const anteriores = await db.reply.count({
    where: { threadId: mensaje.threadId, createdAt: { lt: mensaje.createdAt } },
  });
  const pagina = paginaDe(anteriores, POR_PAGINA.respuestas);

  redirect(
    `/foro/${mensaje.thread.category}/${mensaje.thread.slug}?p=${pagina}#m-${id}`,
  );
}
