import type { StaffTag } from "@/generated/prisma/enums";

/**
 * Los equipos del staff, tal como se llaman en Discord.
 *
 * Viven aquí y no junto a su pastilla porque los usan cosas que no pintan nada:
 * las acciones del panel y la sincronización con Discord. Tirar del componente
 * arrastraba React hasta el servidor sin ninguna necesidad.
 *
 * El orden manda: es el que se sigue al enseñar varios seguidos, y así la misma
 * persona se ve siempre igual en todas las pantallas.
 */
export const EQUIPOS: StaffTag[] = [
  "DEV",
  "ILEGAL",
  "LEGAL",
  "COMERCIO",
  "REDES",
  "EVENTOS",
  "REPORTES",
];

export const EQUIPO_NOMBRE: Record<StaffTag, string> = {
  DEV: "Programador",
  ILEGAL: "Equipo ilegal",
  LEGAL: "Equipo legal",
  COMERCIO: "Equipo comercio",
  REDES: "Gestión de redes",
  EVENTOS: "Gestión de eventos",
  REPORTES: "Gestión de reportes",
};
