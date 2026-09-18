import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { leerPagina, paginar, POR_PAGINA } from "@/lib/paginacion";
import { GaleriaManager } from "@/components/panel/galeria-manager";
import { CabeceraPanel } from "@/components/panel/cabecera-panel";
import { Paginacion } from "@/components/ui/paginacion";

export const metadata: Metadata = { title: "Galería" };
export const dynamic = "force-dynamic";

export default async function PanelGaleriaPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  await requireUser("ADMIN");
  const { p } = await searchParams;

  const cuantas = await db.photo.count();
  const pagina = paginar(cuantas, POR_PAGINA.galeria, leerPagina(p));

  const fotos = await db.photo.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    skip: pagina.salta,
    take: pagina.toma,
    select: { id: true, url: true, width: true, height: true, caption: true },
  });

  return (
    <div className="shell grid max-w-[70rem] gap-[var(--space-lg)] py-[var(--space-xl)]">
      <CabeceraPanel
        titulo="Galería"
        descripcion={
          cuantas === 0
            ? "Las fotos que salen de fondo en la portada."
            : `${cuantas} foto(s) de fondo en la portada, en este mismo orden.`
        }
      />

      <GaleriaManager fotos={fotos} />

      {/* Subir y bajar una foto la mueve respecto a su vecina aunque esa vecina
          esté en otra página: el orden es de todas, no de la página. */}
      <Paginacion
        pagina={pagina}
        href={(numero) =>
          numero > 1 ? `/panel/galeria?p=${numero}` : "/panel/galeria"
        }
        etiqueta="Páginas de la galería"
      />
    </div>
  );
}
