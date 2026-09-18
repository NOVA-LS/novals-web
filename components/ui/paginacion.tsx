import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ventana, type Pagina } from "@/lib/paginacion";

/**
 * Barra de páginas.
 *
 * El destino lo construye quien la usa, porque cada lista arrastra sus propios
 * parámetros en la URL (la búsqueda del foro, el filtro de una categoría) y
 * perderlos al cambiar de página sería peor que no paginar.
 *
 * Con una sola página no se enseña nada: una barra que no lleva a ningún sitio
 * solo ocupa sitio.
 */
export function Paginacion({
  pagina,
  href,
  etiqueta = "Páginas",
}: {
  pagina: Pagina;
  href: (numero: number) => string;
  etiqueta?: string;
}) {
  if (pagina.paginas <= 1) return null;

  const { actual, paginas } = pagina;

  return (
    <nav className="paginacion" aria-label={etiqueta}>
      {actual > 1 ? (
        <Link href={href(actual - 1)} className="chip" rel="prev">
          <ChevronLeft size={13} aria-hidden />
          Anterior
        </Link>
      ) : (
        <span className="chip" aria-disabled data-apagado="true">
          <ChevronLeft size={13} aria-hidden />
          Anterior
        </span>
      )}

      <div className="paginacion__numeros">
        {ventana(actual, paginas).map((numero, posicion) =>
          numero === "hueco" ? (
            <span key={`hueco-${posicion}`} className="meta" aria-hidden>
              …
            </span>
          ) : numero === actual ? (
            <span key={numero} className="chip" data-activo="true" aria-current="page">
              {numero}
            </span>
          ) : (
            <Link
              key={numero}
              href={href(numero)}
              className="chip"
              aria-label={`Página ${numero}`}
            >
              {numero}
            </Link>
          ),
        )}
      </div>

      {actual < paginas ? (
        <Link href={href(actual + 1)} className="chip" rel="next">
          Siguiente
          <ChevronRight size={13} aria-hidden />
        </Link>
      ) : (
        <span className="chip" aria-disabled data-apagado="true">
          Siguiente
          <ChevronRight size={13} aria-hidden />
        </span>
      )}
    </nav>
  );
}
