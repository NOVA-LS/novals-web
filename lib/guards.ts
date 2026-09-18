import { auth } from "./auth";
import { db } from "./db";
import { alcanza } from "./roles";
import type { Role, StaffTag } from "@/generated/prisma/enums";

// La jerarquía en sí vive en lib/roles.ts, que no depende de la sesión.
export { ESCALONES, comparaRoles } from "./roles";

export type SessionUser = {
  id: string;
  discordId: string;
  username: string;
  avatar: string | null;
  role: Role;
  /** Puede jugar en la ciudad, y por tanto escribir en el foro. */
  whitelisted: boolean;
  /** Equipos en los que trabaja. No influyen en los permisos. */
  equipos: StaffTag[];
};

/** Usuario de la sesión con el rol leído de base de datos, o null. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      discordId: true,
      username: true,
      avatar: true,
      role: true,
      whitelisted: true,
      teams: { select: { tag: true } },
    },
  });

  if (!user) return null;

  const { teams, ...resto } = user;
  return { ...resto, equipos: teams.map((fila) => fila.tag) };
}

/**
 * Exige sesión y rol mínimo. Lanza si no se cumple, así una Server Action nunca
 * puede continuar por descuido. El rol sale de la base de datos, no del JWT,
 * porque un token emitido antes de un cambio de rol sigue siendo válido.
 */
export async function requireUser(minimum: Role = "USER"): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("NO_AUTENTICADO");
  if (!alcanza(user.role, minimum)) throw new Error("SIN_PERMISOS");
  return user;
}

export function isStaff(role: Role) {
  return alcanza(role, "INICIADOR");
}
