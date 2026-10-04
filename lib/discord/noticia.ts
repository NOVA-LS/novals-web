import { EMBED_COLOR, type Embed } from "@/lib/embed";

/**
 * El embed que se postea en el canal elegido al publicar una noticia.
 *
 * Todo el aviso vive dentro del embed —cabecera, título, entradilla y
 * pie— para que el mensaje no se vea como una línea suelta seguida de un
 * cuadro aparte.
 *
 * Módulo puro: arma el embed, no lo manda. Quien llama ya trae la url y la
 * portada resueltas a absolutas.
 */
export function construirEmbedNoticia(
  noticia: { title: string; excerpt: string; coverImage: string | null },
  url: string,
  /** Solo se pasa en el privado: en el canal, quien lo lee no está suscrito a
   * nada que pueda desactivar. */
  urlBaja?: string,
): Embed {
  return {
    author: { name: "Se ha publicado una nueva noticia" },
    title: noticia.title,
    // El pie de un embed no admite markdown —un enlace ahí sale como texto
    // suelto, no como algo pulsable—, así que el aviso de baja va en la
    // entradilla, que sí lo renderiza.
    description: urlBaja
      ? `${noticia.excerpt}\n\nPara dejar de recibir este aviso, [entra aquí](${urlBaja}).`
      : noticia.excerpt,
    url,
    color: EMBED_COLOR.neutral,
    footer: urlBaja ? undefined : { text: "Para leer más, entra en la web." },
    // `enviarDM` le pone su propia hora por defecto a todo lo que manda; aquí
    // no aporta nada —ya se sabe que es de ahora mismo— y solo apretaba el
    // pie. Puesto a `undefined` de verdad, no solo omitido: así la clave gana
    // al `...embed` de `enviarDM` y de verdad no sale ninguna.
    timestamp: undefined,
    ...(noticia.coverImage ? { image: { url: noticia.coverImage } } : {}),
  };
}

/**
 * El embed del canal: título en negrita, la entradilla como cita en negrita,
 * una frase fija que lleva a la noticia y la portada debajo.
 *
 * Distinto del privado a propósito: sin cabecera ni pie, y el título no es un
 * enlace —el enlace va en la frase fija, igual para todos los comunicados.
 *
 * Módulo puro, como `construirEmbedNoticia`.
 */
export function construirEmbedCanalNoticia(
  noticia: { title: string; excerpt: string; coverImage: string | null },
  url: string,
): Embed {
  // Una cita de Discord solo cubre su línea: cada línea de la entradilla
  // lleva su propio `> ` y su propia negrita.
  const entradilla = noticia.excerpt
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => `> **${linea}**`)
    .join("\n");

  return {
    title: noticia.title,
    description: `${entradilla}\n\n-# Podrás consultar el contenido completo del mensaje en nuestra [página web](${url}).`,
    color: EMBED_COLOR.neutral,
    ...(noticia.coverImage ? { image: { url: noticia.coverImage } } : {}),
  };
}
