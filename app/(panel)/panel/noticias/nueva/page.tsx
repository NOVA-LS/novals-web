import type { Metadata } from "next";
import { requireUser } from "@/lib/guards";
import { EditorNoticia } from "@/components/panel/editor-noticia";
import { CabeceraPanel } from "@/components/panel/cabecera-panel";

export const metadata: Metadata = { title: "Nueva noticia" };
export const dynamic = "force-dynamic";

export default async function NuevaNoticiaPage() {
  await requireUser("ADMIN");

  return (
    <div className="shell grid max-w-[64rem] gap-[var(--space-lg)] py-[var(--space-xl)]">
      <CabeceraPanel
        titulo="Nueva noticia"
        volver={{ href: "/panel/noticias", texto: "Noticias" }}
      />
      <EditorNoticia />
    </div>
  );
}
