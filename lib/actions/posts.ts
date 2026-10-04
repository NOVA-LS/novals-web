"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { ETIQUETA } from "@/lib/consultas";
import { ACCIONES, apuntar } from "@/lib/auditoria";
import { guardarImagen } from "@/lib/uploads";
import { slugify } from "@/lib/utils";
import { renderMarkdown } from "@/lib/markdown";
import { esquemaNoticia } from "@/lib/noticias";
import { enviarDM, listarCanales, listarRoles, publicarEnCanal } from "@/lib/discord";
import type { Embed } from "@/lib/embed";
import { agruparPorCategoria, type GrupoDeCanales } from "@/lib/discord/canales";
import { rolesMencionables, type RolDiscord } from "@/lib/discord/menciones";
import { construirEmbedNoticia, construirMensajeCanalNoticia } from "@/lib/discord/noticia";

export type ResultadoNoticia = { ok: boolean; mensaje?: string };

function baseUrl() {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * A quien tenga el aviso activado, un privado con la misma noticia.
 *
 * En paralelo, como `avisarTicketPorDiscord`. Que a alguien le rebote el
 * privado —lo normal es tener los mensajes directos cerrados— no es un fallo
 * nuestro ni algo que el staff pueda arreglar, así que no se registra.
 */
async function avisarSuscriptores(embed: Embed) {
  const suscriptores = await db.user.findMany({
    where: { avisosNoticias: true },
    select: { discordId: true },
  });

  await Promise.all(
    suscriptores.map(async ({ discordId }) => {
      const resultado = await enviarDM(discordId, embed);
      if (!resultado.ok && resultado.motivo === "ERROR") {
        console.error(`No se pudo avisar de la noticia a ${discordId}: ${resultado.detalle}`);
      }
    }),
  );
}

/**
 * Avisa de que la noticia ya está publicada: en el canal de Discord elegido,
 * si lo hay, y por privado a quien lo tenga activado, si se pidió.
 *
 * Nunca lanza —ni `publicarEnCanal` ni `enviarDM` lo hacen— así que un
 * Discord caído no puede tumbar la publicación en la web.
 */
async function avisarPublicacion(noticia: {
  title: string;
  excerpt: string;
  slug: string;
  coverImage: string | null;
  channelId?: string | null;
  roleId?: string | null;
  notificarPrivado: boolean;
}) {
  const datos = {
    title: noticia.title,
    excerpt: noticia.excerpt,
    coverImage: noticia.coverImage ? `${baseUrl()}${noticia.coverImage}` : null,
  };
  const url = `${baseUrl()}/noticias/${noticia.slug}`;

  await Promise.all([
    noticia.channelId
      ? publicarEnCanal(
          noticia.channelId,
          construirMensajeCanalNoticia(datos, url, noticia.roleId),
        )
      : undefined,
    // Solo el privado dice cómo desactivarlo: en el canal no hay nada personal
    // que apagar. Tampoco comparten formato: el canal lleva el de comunicado.
    noticia.notificarPrivado
      ? avisarSuscriptores(construirEmbedNoticia(datos, url, `${baseUrl()}/avisos/ajustes`))
      : undefined,
  ]);
}

/**
 * Canales del servidor agrupados por categoría, para el desplegable del
 * editor.
 *
 * Se cachea un minuto en memoria: es una lista de Discord que apenas cambia,
 * y sin esto cada carga del editor golpearía la API de Discord.
 */
let cacheCanales: { hasta: number; grupos: GrupoDeCanales[] } | null = null;
const DURACION_CACHE_MS = 60_000;

export async function listarCanalesDiscord(): Promise<GrupoDeCanales[]> {
  await requireUser("ADMIN");

  if (cacheCanales && cacheCanales.hasta > Date.now()) return cacheCanales.grupos;

  const grupos = agruparPorCategoria(await listarCanales());
  cacheCanales = { hasta: Date.now() + DURACION_CACHE_MS, grupos };
  return grupos;
}

/** El máximo que da WEBP con pérdida. Una portada lleva texto y logos, y a 82
 * —lo normal en las fotos de galería— se ven con halo; `smartSubsample` evita
 * además que los bordes blancos sobre fondo oscuro pierdan color. */
const WEBP_PORTADA = { quality: 100, smartSubsample: true } as const;

type Portada = { url: string; width: number; height: number };

async function guardarPortada(archivo: File | null): Promise<Portada | undefined> {
  if (!archivo || archivo.size === 0) return undefined;
  return guardarImagen(archivo, "La portada", undefined, WEBP_PORTADA);
}

/** Slug único: si ya existe, se le añade un sufijo corto. */
async function slugLibre(titulo: string, idActual?: string) {
  const base = slugify(titulo) || "noticia";
  let candidato = base;
  let intento = 1;

  while (true) {
    const existente = await db.post.findUnique({
      where: { slug: candidato },
      select: { id: true },
    });
    if (!existente || existente.id === idActual) return candidato;
    candidato = `${base}-${++intento}`;
  }
}

export async function guardarNoticia(
  id: string | null,
  datos: FormData,
): Promise<ResultadoNoticia> {
  const autor = await requireUser("ADMIN");

  const parsed = esquemaNoticia.safeParse({
    title: datos.get("title"),
    excerpt: datos.get("excerpt"),
    contentMd: datos.get("contentMd"),
    published: datos.get("published") === "on",
    notificarPrivado: datos.get("notificarPrivado") === "on",
    channelId: datos.get("channelId") ?? "",
    roleId: datos.get("roleId") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, mensaje: parsed.error.issues[0].message };
  }

  let portada: Portada | undefined;
  try {
    portada = await guardarPortada(datos.get("coverImage") as File | null);
  } catch (error) {
    return { ok: false, mensaje: (error as Error).message };
  }

  const previa = id
    ? await db.post.findUnique({
        where: { id },
        select: { publishedAt: true, coverImage: true, discordAvisadoEn: true },
      })
    : null;

  // Toda noticia necesita portada: si no se sube una ahora, tiene que
  // quedarle la de antes.
  if (!portada && !previa?.coverImage) {
    return { ok: false, mensaje: "Sube una imagen de portada." };
  }

  // Un rol sin canal no tiene dónde mencionarse: no se guarda.
  const { channelId, roleId: rol, ...campos } = parsed.data;
  const roleId = channelId ? rol : undefined;
  const slug = await slugLibre(campos.title, id ?? undefined);
  const publicando = campos.published;
  // Sin canal y sin privado no hay nada que avisar: no se da por avisada, para
  // que si luego se activa alguno de los dos, salga la primera vez que se guarde.
  const hayAviso = !!channelId || campos.notificarPrivado;

  if (id) {
    // Solo se avisa la primera vez: despublicar y volver a publicar no repite
    // el mensaje, aunque el resto de la noticia haya cambiado.
    const avisar = publicando && hayAviso && !previa?.discordAvisadoEn;

    await db.post.update({
      where: { id },
      data: {
        ...campos,
        channelId,
        roleId,
        slug,
        ...(portada
          ? { coverImage: portada.url, coverWidth: portada.width, coverHeight: portada.height }
          : {}),
        publishedAt: publicando ? (previa?.publishedAt ?? new Date()) : null,
        ...(avisar ? { discordAvisadoEn: new Date() } : {}),
      },
    });

    if (avisar) {
      await avisarPublicacion({
        ...campos,
        slug,
        coverImage: portada?.url ?? previa?.coverImage ?? null,
        channelId,
        roleId,
      });
    }
  } else {
    await db.post.create({
      data: {
        ...campos,
        channelId,
        roleId,
        slug,
        coverImage: portada?.url,
        coverWidth: portada?.width,
        coverHeight: portada?.height,
        authorId: autor.id,
        publishedAt: publicando ? new Date() : null,
        ...(publicando && hayAviso ? { discordAvisadoEn: new Date() } : {}),
      },
    });

    if (publicando && hayAviso) {
      await avisarPublicacion({
        ...campos,
        slug,
        coverImage: portada?.url ?? null,
        channelId,
        roleId,
      });
    }
  }

  // Lo publicado se sirve de caché: sin esto, el cambio no se vería hasta que
  // caducara sola.
  updateTag(ETIQUETA.noticias);
  revalidatePath("/");
  revalidatePath("/noticias");
  revalidatePath(`/noticias/${slug}`);
  revalidatePath("/panel/noticias");
  redirect("/panel/noticias");
}

/**
 * Markdown saneado para la vista previa del editor.
 *
 * No se hace en el navegador: el saneado vive en `lib/markdown.ts`, que es
 * server-only, y es el mismo que se aplica al publicar. Tenerlo en un solo
 * sitio evita que la vista previa muestre algo que luego el saneado real
 * recorta —o, peor, que muestre HTML sin sanear en el propio navegador del
 * admin.
 */
export async function previsualizarMarkdown(markdown: string): Promise<string> {
  await requireUser("ADMIN");
  return renderMarkdown(markdown);
}
/** Igual que los canales: se cachea un minuto para no golpear la API de Discord. */
let cacheRoles: { hasta: number; roles: RolDiscord[] } | null = null;

export async function listarRolesDiscord(): Promise<RolDiscord[]> {
  await requireUser("ADMIN");

  if (cacheRoles && cacheRoles.hasta > Date.now()) return cacheRoles.roles;

  const roles = rolesMencionables(await listarRoles(), process.env.DISCORD_GUILD_ID?.trim());
  cacheRoles = { hasta: Date.now() + DURACION_CACHE_MS, roles };
  return roles;
}

export async function cambiarPublicacion(id: string, publicar: boolean) {
  const autor = await requireUser("ADMIN");

  const previa = await db.post.findUnique({
    where: { id },
    select: { channelId: true, notificarPrivado: true, discordAvisadoEn: true },
  });
  // Solo se avisa la primera vez: despublicar y volver a publicar no repite
  // el mensaje.
  const avisar =
    publicar &&
    !previa?.discordAvisadoEn &&
    (!!previa?.channelId || !!previa?.notificarPrivado);

  const noticia = await db.post.update({
    where: { id },
    data: {
      published: publicar,
      publishedAt: publicar ? new Date() : null,
      ...(avisar ? { discordAvisadoEn: new Date() } : {}),
    },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      coverImage: true,
      channelId: true,
      roleId: true,
      notificarPrivado: true,
    },
  });

  if (avisar) await avisarPublicacion(noticia);

  await apuntar({
    accion: ACCIONES.CONTENIDO,
    actor: autor,
    objetivo: `Noticia «${noticia.title}»`,
    url: `/noticias/${noticia.slug}`,
    detalle: publicar ? "publicada" : "retirada",
  });

  // Lo publicado se sirve de caché: sin esto, el cambio no se vería hasta que
  // caducara sola.
  updateTag(ETIQUETA.noticias);
  revalidatePath("/");
  revalidatePath("/noticias");
  revalidatePath(`/noticias/${noticia.slug}`);
  revalidatePath("/panel/noticias");
}
