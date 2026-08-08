"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { ETIQUETA } from "@/lib/consultas";
import { ACCIONES, apuntar } from "@/lib/auditoria";
import { guardarImagen } from "@/lib/uploads";
import { slugify } from "@/lib/utils";

const esquemaNoticia = z.object({
  title: z.string().trim().min(3, "El título es demasiado corto.").max(120),
  excerpt: z.string().trim().min(10, "Escribe una entradilla.").max(300),
  contentMd: z.string().trim().min(20, "El contenido es demasiado corto."),
  published: z.coerce.boolean(),
});

export type ResultadoNoticia = { ok: boolean; mensaje?: string };

async function guardarPortada(archivo: File | null): Promise<string | undefined> {
  if (!archivo || archivo.size === 0) return undefined;
  const { url } = await guardarImagen(archivo, "La portada");
  return url;
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
  });

  if (!parsed.success) {
    return { ok: false, mensaje: parsed.error.issues[0].message };
  }

  let portada: string | undefined;
  try {
    portada = await guardarPortada(datos.get("coverImage") as File | null);
  } catch (error) {
    return { ok: false, mensaje: (error as Error).message };
  }

  const slug = await slugLibre(parsed.data.title, id ?? undefined);
  const publicando = parsed.data.published;

  if (id) {
    const previa = await db.post.findUnique({
      where: { id },
      select: { publishedAt: true },
    });

    await db.post.update({
      where: { id },
      data: {
        ...parsed.data,
        slug,
        ...(portada ? { coverImage: portada } : {}),
        publishedAt: publicando ? (previa?.publishedAt ?? new Date()) : null,
      },
    });
  } else {
    await db.post.create({
      data: {
        ...parsed.data,
        slug,
        coverImage: portada,
        authorId: autor.id,
        publishedAt: publicando ? new Date() : null,
      },
    });
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

export async function cambiarPublicacion(id: string, publicar: boolean) {
  const autor = await requireUser("ADMIN");

  const noticia = await db.post.update({
    where: { id },
    data: {
      published: publicar,
      publishedAt: publicar ? new Date() : null,
    },
    select: { slug: true, title: true },
  });

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
