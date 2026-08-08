import "server-only";
import { currentUser } from "@/lib/guards";
import type { Actor } from "@/lib/foro/reglas";

/**
 * Traduce la sesión al actor que entienden las reglas del foro.
 *
 * La whitelist sale de la base de datos y no del token: quien la pasó ayer tiene
 * que poder escribir hoy sin volver a entrar, y a quien se la quitan deja de
 * poder al momento.
 */
export async function actorActual(): Promise<Actor | null> {
  const usuario = await currentUser();
  if (!usuario) return null;

  return {
    id: usuario.id,
    role: usuario.role,
    tieneWhitelist: usuario.whitelisted,
  };
}
