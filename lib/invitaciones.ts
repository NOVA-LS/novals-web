import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sincronizarInsignias } from "@/lib/insignias/sincronizar";

/** Nombre de la cookie que deja `/r/[codigo]` y lee el alta de cuenta. */
export const COOKIE_REF = "ref";

/**
 * A quién atribuir una cuenta nueva, según la cookie que dejó `/r/[codigo]`.
 *
 * No lanza: sin cookie, o con un id que no corresponde a nadie, simplemente
 * no atribuye. Solo tiene sentido llamarla al crear una cuenta — ver
 * lib/auth.ts, donde `referredById` se pone una única vez.
 */
export async function referidoDeLaCookie(): Promise<string | undefined> {
  const almacen = await cookies();
  const codigo = almacen.get(COOKIE_REF)?.value;
  if (!codigo) return undefined;

  const referido = await db.user.findUnique({
    where: { id: codigo },
    select: { id: true },
  });
  return referido?.id;
}

/**
 * Si `userId` tiene whitelist y alguien le invitó, le pone al día las
 * insignias a quien le invitó — es su cuenta la que acaba de subir, no la de
 * `userId`.
 *
 * Se llama justo después de que `whitelisted` pase a `true`, en los dos
 * sitios donde eso ocurre: lib/actions/submissions.ts y
 * lib/discord/sincronizar.ts.
 */
export async function sincronizarSiInvitado(userId: string): Promise<void> {
  const usuario = await db.user.findUnique({
    where: { id: userId },
    select: { referredById: true, whitelisted: true },
  });
  if (usuario?.whitelisted && usuario.referredById) {
    await sincronizarInsignias(usuario.referredById);
  }
}
