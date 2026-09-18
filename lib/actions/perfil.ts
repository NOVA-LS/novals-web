"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";

/** Cada cual decide si quiere el aviso; nadie más lo cambia por él. */
export async function actualizarAvisosNoticias(activar: boolean) {
  const usuario = await requireUser("USER");

  await db.user.update({
    where: { id: usuario.id },
    // Tocarlo a mano ya cuenta como respuesta: no hace falta preguntarle
    // también con el aviso de bienvenida.
    data: { avisosNoticias: activar, avisosNoticiasPreguntado: true },
  });

  revalidatePath("/perfil");
  revalidatePath("/avisos/ajustes");
}
