import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { formatearFecha } from "@/lib/utils";

/**
 * Consultas cacheadas de lo que no cambia con quién mira.
 *
 * Las noticias y las fotos de la portada son iguales para todo el mundo y se
 * tocan una vez a la semana, pero se leían en cada visita. Aquí se guardan hasta
 * que alguien las cambia: cada acción del panel marca su etiqueta y lo demás se
 * sirve de la caché.
 *
 * Las páginas siguen siendo dinámicas —la cabecera lee la sesión—, así que esto
 * no ahorra el render, ahorra las consultas.
 *
 * Cuidado al añadir cosas aquí: lo que se guarda pasa por serialización, así que
 * un `Date` vuelve convertido en texto. Por eso las fechas salen ya formateadas
 * y el Markdown ya renderizado: lo que entra en caché es lo que se pinta.
 */

export const ETIQUETA = {
  noticias: "noticias",
  galeria: "galeria",
  /* Nadie cachea hoy el estado de los formularios —las tarjetas lo miran en
     directo porque además dependen de quién mira—, pero abrir y cerrar sigue
     marcando la etiqueta: el día que vuelva a cachearse, ya está avisado. */
  formularios: "formularios",
} as const;

/** Techo de seguridad: si un `revalidateTag` se pierde, se rehace igualmente. */
const UNA_HORA = 3600;

const RESUMEN_NOTICIA = {
  slug: true,
  title: true,
  excerpt: true,
  coverImage: true,
  publishedAt: true,
} as const;

export type ResumenNoticia = {
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  fecha: string | null;
};

/** Las tres últimas, para la portada. */
export const noticiasDePortada = unstable_cache(
  async (): Promise<ResumenNoticia[]> => {
    const noticias = await db.post.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: RESUMEN_NOTICIA,
    });

    return noticias.map(conFecha);
  },
  ["portada-noticias"],
  { tags: [ETIQUETA.noticias], revalidate: UNA_HORA },
);

export const contarNoticias = unstable_cache(
  () => db.post.count({ where: { published: true } }),
  ["noticias-total"],
  { tags: [ETIQUETA.noticias], revalidate: UNA_HORA },
);

/** Una página del listado. Los argumentos entran en la clave de la caché. */
export const paginaDeNoticias = unstable_cache(
  async (salta: number, toma: number): Promise<ResumenNoticia[]> => {
    const noticias = await db.post.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      skip: salta,
      take: toma,
      select: RESUMEN_NOTICIA,
    });

    return noticias.map(conFecha);
  },
  ["noticias-pagina"],
  { tags: [ETIQUETA.noticias], revalidate: UNA_HORA },
);

export type NoticiaCompleta = {
  title: string;
  excerpt: string;
  coverImage: string | null;
  /** Markdown ya convertido y saneado: convertirlo en cada visita es tirar CPU. */
  html: string;
  fecha: string | null;
  autor: string;
};

export const noticiaPorSlug = unstable_cache(
  async (slug: string): Promise<NoticiaCompleta | null> => {
    const noticia = await db.post.findFirst({
      where: { slug, published: true },
      select: {
        title: true,
        excerpt: true,
        coverImage: true,
        contentMd: true,
        publishedAt: true,
        author: { select: { username: true } },
      },
    });
    if (!noticia) return null;

    return {
      title: noticia.title,
      excerpt: noticia.excerpt,
      coverImage: noticia.coverImage,
      html: renderMarkdown(noticia.contentMd),
      fecha: noticia.publishedAt ? formatearFecha(noticia.publishedAt) : null,
      autor: noticia.author.username,
    };
  },
  ["noticia"],
  { tags: [ETIQUETA.noticias], revalidate: UNA_HORA },
);

export const fotosDePortada = unstable_cache(
  () =>
    db.photo.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      take: 8,
      select: { id: true, url: true, width: true, height: true, caption: true },
    }),
  ["portada-fotos"],
  { tags: [ETIQUETA.galeria], revalidate: UNA_HORA },
);

function conFecha(noticia: {
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  publishedAt: Date | null;
}): ResumenNoticia {
  const { publishedAt, ...resto } = noticia;
  return { ...resto, fecha: publishedAt ? formatearFecha(publishedAt) : null };
}
