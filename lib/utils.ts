import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FECHA = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const FECHA_HORA = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatearFecha(date: Date | string) {
  return FECHA.format(new Date(date));
}

export function formatearFechaHora(date: Date | string) {
  return FECHA_HORA.format(new Date(date));
}

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/**
 * Cuánto hace, en corto: "hace 5 min", "hace 3 h", "hace 2 d".
 *
 * En una lista de avisos importa lo reciente que es cada uno, no el día exacto;
 * a partir de una semana ya vuelve la fecha, que es lo que se busca entonces.
 */
export function hace(fecha: Date | string, ahora: Date = new Date()) {
  const transcurrido = ahora.getTime() - new Date(fecha).getTime();

  if (transcurrido < MINUTO) return "ahora mismo";
  if (transcurrido < HORA) return `hace ${Math.floor(transcurrido / MINUTO)} min`;
  if (transcurrido < DIA) return `hace ${Math.floor(transcurrido / HORA)} h`;
  if (transcurrido < 7 * DIA) return `hace ${Math.floor(transcurrido / DIA)} d`;

  return formatearFecha(fecha);
}

/** Slug para URLs de noticia: sin acentos, sin símbolos, separado por guiones. */
export function slugify(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
