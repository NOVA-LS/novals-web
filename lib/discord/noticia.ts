import { mencionTapada } from "@/lib/discord/menciones";
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

/** Banderas de un mensaje cuyo contenido son componentes en vez de texto y embeds. */
const MENSAJE_DE_COMPONENTES = 1 << 15;

const COMPONENTE = { contenedor: 17, texto: 10, galeria: 12 } as const;

/**
 * El mensaje del canal: un contenedor con el título en grande, la entradilla
 * como cita en negrita, una frase fija que lleva a la noticia y la portada
 * debajo; y, fuera del contenedor y debajo de todo, la mención al rol tapada.
 *
 * No es un embed porque un embed no puede llevar texto debajo de su cuadro ni
 * notificar con lo que lleva dentro. Un mensaje de componentes puede las dos
 * cosas, pero entonces no admite `content` ni `embeds`.
 *
 * Distinto del privado a propósito: el título no es un enlace —el enlace va en
 * la frase fija, igual para todos los comunicados.
 *
 * Módulo puro, como `construirEmbedNoticia`.
 */
export function construirMensajeCanalNoticia(
  noticia: { title: string; excerpt: string; coverImage: string | null },
  url: string,
  rolId?: string | null,
) {
  // Una cita de Discord solo cubre su línea: cada línea de la entradilla
  // lleva su propio `> ` y su propia negrita.
  const entradilla = noticia.excerpt
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => `> **${linea}**`)
    .join("\n");

  const mencion = mencionTapada(rolId);

  return {
    flags: MENSAJE_DE_COMPONENTES,
    components: [
      {
        type: COMPONENTE.contenedor,
        accent_color: EMBED_COLOR.neutral,
        components: [
          { type: COMPONENTE.texto, content: `## ${noticia.title}` },
          {
            type: COMPONENTE.texto,
            content: `${entradilla}\n\n-# Podrás consultar el contenido completo del mensaje en nuestra [página web](${url}).`,
          },
          ...(noticia.coverImage
            ? [{ type: COMPONENTE.galeria, items: [{ media: { url: noticia.coverImage } }] }]
            : []),
        ],
      },
      ...(mencion ? [{ type: COMPONENTE.texto, content: mencion }] : []),
    ],
    // Solo ese rol: nada de lo que lleve el título o la entradilla puede acabar
    // mencionando a `@everyone` ni a otros.
    allowed_mentions: { parse: [], roles: mencion && rolId ? [rolId] : [] },
  };
}
