import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { EditorNoticia } from "@/components/panel/editor-noticia";
import { CabeceraPanel } from "@/components/panel/cabecera-panel";

export const metadata: Metadata = { title: "Editar noticia" };
export const dynamic = "force-dynamic";

export default async function EditarNoticiaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser("ADMIN");
  const { id } = await params;

  const noticia = await db.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      excerpt: true,
      contentMd: true,
      published: true,
      coverImage: true,
    },
  });

  if (!noticia) notFound();

  return (
    <div className="shell grid max-w-[64rem] gap-[var(--space-lg)] py-[var(--space-xl)]">
      <CabeceraPanel
        titulo="Editar noticia"
        descripcion={noticia.title}
        volver={{ href: "/panel/noticias", texto: "Noticias" }}
      />
      <EditorNoticia noticia={noticia} />
    </div>
  );
}
