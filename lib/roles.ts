import type { Role } from "@/generated/prisma/enums";

/**
 * La jerarquía del staff, sin nada alrededor.
 *
 * Vive aparte de `lib/guards.ts` porque aquello depende de la sesión y de
 * next-auth, y comparar dos roles no necesita ninguna de las dos cosas. Así
 * cualquier módulo puede preguntar «¿este rol llega a este otro?» sin arrastrar
 * media aplicación detrás.
 */

const ALTURA: Record<Role, number> = {
  USER: 0,
  INICIADOR: 1,
  SOPORTE: 2,
  MODERADOR: 3,
  ADMIN: 4,
};

/** Cómo se llama cada rol de cara al jugador. */
export const ROL_TEXTO: Record<Role, string> = {
  USER: "Jugador",
  INICIADOR: "Iniciador",
  SOPORTE: "Soporte",
  MODERADOR: "Moderador",
  ADMIN: "Administrador",
};

/** Los escalones del staff, del más bajo al más alto. */
export const ESCALONES: Role[] = ["INICIADOR", "SOPORTE", "MODERADOR", "ADMIN"];

/** Compara dos roles por su altura. Negativo si `a` está por debajo de `b`. */
export function comparaRoles(a: Role, b: Role) {
  return ALTURA[a] - ALTURA[b];
}

/** Si `rol` llega al escalón `minimo`. */
export function alcanza(rol: Role, minimo: Role) {
  return ALTURA[rol] >= ALTURA[minimo];
}

/** Los escalones desde `minimo` hacia arriba: quiénes ven algo de ese nivel. */
export function desde(minimo: Role): Role[] {
  return ESCALONES.filter((escalon) => alcanza(escalon, minimo));
}

/** Los escalones hasta `rol`: lo que alcanza a ver quien tiene ese rol. */
export function hasta(rol: Role): Role[] {
  return ESCALONES.filter((escalon) => alcanza(rol, escalon));
}
