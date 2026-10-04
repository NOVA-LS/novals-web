import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { formatearFechaHora } from "@/lib/utils";
import { listarCanalesDiscord, listarRolesDiscord } from "@/lib/actions/posts";
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

  const [noticia, canales, roles] = await Promise.all([
    db.post.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        excerpt: true,
        contentMd: true,
        published: true,
        coverImage: true,
        channelId: true,
        roleId: true,
        notificarPrivado: true,
        discordAvisadoEn: true,
        poll: {
          select: {
            question: true,
            closesAt: true,
            options: { orderBy: { position: "asc" }, select: { id: true, label: true } },
            _count: { select: { votes: true } },
          },
        },
      },
    }),
    listarCanalesDiscord(),
    listarRolesDiscord(),
  ]);

  if (!noticia) notFound();

  const { poll, discordAvisadoEn, ...datosNoticia } = noticia;

  return (
    <div className="shell grid max-w-[64rem] gap-[var(--space-lg)] py-[var(--space-xl)]">
      <CabeceraPanel
        titulo="Editar noticia"
        descripcion={noticia.title}
        volver={{ href: "/panel/noticias", texto: "Noticias" }}
      />
      <EditorNoticia
        noticia={{
          ...datosNoticia,
          // Ya formateada aquí: el navegador no tiene la zona horaria del servidor.
          avisadaEn: discordAvisadoEn ? formatearFechaHora(discordAvisadoEn) : null,
          encuesta: poll
            ? {
                question: poll.question,
                closesAt: poll.closesAt?.toISOString() ?? null,
                options: poll.options,
                votos: poll._count.votes,
              }
            : null,
        }}
        canales={canales}
        roles={roles}
      />
    </div>
  );
}
