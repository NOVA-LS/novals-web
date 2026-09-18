"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";

/**
 * Abre un aviso: lo marca leído y lleva a donde apunta.
 *
 * El destino se comprueba aunque lo escriba nuestro propio código: si algún día
 * alguien mete una URL entera en un aviso, esto es lo único que separa la
 * campana de un salto a otro sitio con nuestro dominio de por medio.
 */
export async function abrirAviso(datos: FormData) {
  const usuario = await requireUser();
  const id = String(datos.get("id") ?? "");

  const aviso = await db.notification.findUnique({
    where: { id },
    select: { userId: true, url: true },
  });

  // Los avisos de otro ni se leen ni se abren: se responde igual que si no
  // existiera, sin decir cuál de las dos cosas pasa.
  if (!aviso || aviso.userId !== usuario.id) redirect("/avisos");

  await db.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  const destino =
    aviso.url.startsWith("/") && !aviso.url.startsWith("//") ? aviso.url : "/avisos";

  revalidatePath("/", "layout");
  redirect(destino);
}

/** Deja la campana a cero sin tener que abrirlos uno a uno. */
export async function marcarTodoLeido() {
  const usuario = await requireUser();

  await db.notification.updateMany({
    where: { userId: usuario.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/", "layout");
}
