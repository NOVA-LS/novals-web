/**
 * Las insignias que se pueden ganar.
 *
 * Viven en código y no en la base de datos porque cada una lleva una condición,
 * y una condición es código. En la base solo queda quién la tiene y desde
 * cuándo. Nadie las reparte a mano: se ganan o no se ganan.
 *
 * Módulo puro, sin acceso a datos: recibe las cuentas ya hechas y decide. Así se
 * puede probar sin base de datos y la misma regla vale para conceder y para
 * enseñarle a alguien cuánto le falta.
 */

export type MetricasJugador = {
  /** Días desde que se creó la cuenta. */
  diasDeCuenta: number;
  /** Mensajes escritos en el foro, sin contar los hilos que abrió. */
  mensajes: number;
  /** Hilos abiertos en el foro. */
  hilos: number;
  tieneWhitelist: boolean;
  esStaff: boolean;
  /** Invitados suyos (por /r/su-id) que han pasado la whitelist. */
  invitadosConWhitelist: number;
};

export type DefinicionInsignia = {
  /** Se guarda en la base de datos: no se cambia una vez repartida. */
  slug: string;
  nombre: string;
  descripcion: string;
  /** Nombre de un icono de components/ui/insignia.tsx */
  icono: string;
  /** Qué hay que hacer, dicho para el jugador. */
  comoSeGana: string;
  /** Se cumple o no. Sin medias tintas y sin efectos: solo lee las cuentas. */
  seCumple: (metricas: MetricasJugador) => boolean;
  /**
   * Cuánto lleva hecho, de 0 a 1, para la barra de progreso. Las que no son de
   * contar no la tienen: o la tienes o no.
   */
  avance?: (metricas: MetricasJugador) => number;
};

/** Progreso de un contador, acotado entre 0 y 1. */
function proporcion(actual: number, meta: number) {
  return Math.max(0, Math.min(1, actual / meta));
}

export const INSIGNIAS: DefinicionInsignia[] = [
  {
    slug: "ciudadano",
    nombre: "Ciudadano",
    descripcion: "Pasó la whitelist y tiene sitio en Los Santos.",
    icono: "Shield",
    comoSeGana: "Que te acepten la whitelist.",
    seCumple: (m) => m.tieneWhitelist,
  },
  {
    slug: "primera-palabra",
    nombre: "Primera palabra",
    descripcion: "Rompió el hielo en el foro.",
    icono: "Sparkles",
    comoSeGana: "Escribir tu primer mensaje en el foro.",
    seCumple: (m) => m.mensajes >= 1,
    avance: (m) => proporcion(m.mensajes, 1),
  },
  {
    slug: "habitual",
    nombre: "Habitual",
    descripcion: "Se le ve el pelo por el foro a menudo.",
    icono: "Heart",
    comoSeGana: "Escribir 25 mensajes en el foro.",
    seCumple: (m) => m.mensajes >= 25,
    avance: (m) => proporcion(m.mensajes, 25),
  },
  {
    slug: "voz-de-la-ciudad",
    nombre: "Voz de la ciudad",
    descripcion: "Cien mensajes. Ya es parte del paisaje.",
    icono: "Star",
    comoSeGana: "Escribir 100 mensajes en el foro.",
    seCumple: (m) => m.mensajes >= 100,
    avance: (m) => proporcion(m.mensajes, 100),
  },
  {
    slug: "narrador",
    nombre: "Narrador",
    descripcion: "Abre hilos y da de qué hablar.",
    icono: "Drama",
    comoSeGana: "Abrir 10 hilos en el foro.",
    seCumple: (m) => m.hilos >= 10,
    avance: (m) => proporcion(m.hilos, 10),
  },
  {
    slug: "veterano",
    nombre: "Veterano",
    descripcion: "Medio año en la ciudad.",
    icono: "Gem",
    comoSeGana: "Cumplir 180 días desde que entraste.",
    seCumple: (m) => m.diasDeCuenta >= 180,
    avance: (m) => proporcion(m.diasDeCuenta, 180),
  },
  {
    slug: "equipo",
    nombre: "Equipo",
    descripcion: "Ha formado parte del staff.",
    icono: "Crown",
    comoSeGana: "Formar parte del staff en algún momento.",
    seCumple: (m) => m.esStaff,
  },
  {
    slug: "reclutador",
    nombre: "Reclutador",
    descripcion: "Ha traído a varios que se han quedado.",
    icono: "Users",
    comoSeGana: "Que 5 invitados tuyos pasen la whitelist.",
    seCumple: (m) => m.invitadosConWhitelist >= 5,
    avance: (m) => proporcion(m.invitadosConWhitelist, 5),
  },
  {
    slug: "embajador",
    nombre: "Embajador",
    descripcion: "Referencia de la ciudad: trae gente que se queda.",
    icono: "Megaphone",
    comoSeGana: "Que 15 invitados tuyos pasen la whitelist.",
    seCumple: (m) => m.invitadosConWhitelist >= 15,
    avance: (m) => proporcion(m.invitadosConWhitelist, 15),
  },
];

export function getInsignia(slug: string): DefinicionInsignia | undefined {
  return INSIGNIAS.find((insignia) => insignia.slug === slug);
}

/** Las que corresponden a estas cuentas, en el orden del catálogo. */
export function insigniasGanadas(metricas: MetricasJugador): string[] {
  return INSIGNIAS.filter((insignia) => insignia.seCumple(metricas)).map(
    (insignia) => insignia.slug,
  );
}

/**
 * Las que faltan por conceder: las ganadas menos las que ya tiene.
 *
 * Nunca devuelve nada que quitar. Una insignia ganada no se pierde porque un
 * mensaje se borre después: lo hizo, y quitársela sería peor que el redondeo.
 */
export function insigniasPendientes(
  metricas: MetricasJugador,
  yaTiene: string[],
): string[] {
  const tiene = new Set(yaTiene);
  return insigniasGanadas(metricas).filter((slug) => !tiene.has(slug));
}
