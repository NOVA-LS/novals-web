import { cn } from "@/lib/utils";

/**
 * Hueco gris con la forma de lo que va a llegar.
 *
 * Va oculto para los lectores de pantalla: quien no ve la página no gana nada
 * con la silueta. El aviso de que se está cargando lo da una sola vez la
 * pantalla entera, con `role="status"`.
 */
export function Esqueleto({
  ancho,
  alto,
  className,
}: {
  ancho?: string;
  alto?: string;
  className?: string;
}) {
  // Las medidas solo se escriben si se piden: puestas siempre, ganarían a la
  // clase de quien quiere dar la forma con utilidades (una caja 16:9, por
  // ejemplo), porque el estilo en línea se impone al de la hoja.
  return (
    <span
      className={cn("esqueleto", className)}
      style={{ width: ancho, height: alto }}
      aria-hidden
    />
  );
}

/** Envoltorio de una pantalla entera en carga. */
export function Cargando({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("shell grid gap-[var(--space-lg)] py-[var(--space-2xl)]", className)}
    >
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  );
}

/** Cabecera de sección: un título y una línea de apoyo. */
export function EsqueletoCabecera() {
  return (
    <div className="grid gap-[var(--space-xs)]">
      <Esqueleto ancho="14rem" alto="2rem" />
      <Esqueleto ancho="22rem" alto="0.9rem" />
    </div>
  );
}

/** Rejilla de tarjetas, como la de noticias o la de accesos del panel. */
export function EsqueletoTarjetas({
  cuantas = 6,
  conImagen = false,
}: {
  cuantas?: number;
  conImagen?: boolean;
}) {
  return (
    <div className="grid gap-[var(--space-md)] sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: cuantas }, (_, indice) => (
        <div key={indice} className="tile grid content-start gap-[var(--space-sm)]">
          {conImagen ? <Esqueleto className="aspect-video w-full" /> : null}
          <Esqueleto ancho="5rem" alto="0.7rem" />
          <Esqueleto ancho="80%" alto="1.2rem" />
          <Esqueleto alto="0.8rem" />
          <Esqueleto ancho="60%" alto="0.8rem" />
        </div>
      ))}
    </div>
  );
}

/** Lista de filas, como la de hilos o la de solicitudes. */
export function EsqueletoLista({ filas = 8 }: { filas?: number }) {
  return (
    <div className="grid gap-[var(--space-xs)]">
      {Array.from({ length: filas }, (_, indice) => (
        <div key={indice} className="tile grid gap-[var(--space-2xs)] py-[var(--space-sm)]">
          <Esqueleto ancho={`${55 + ((indice * 7) % 35)}%`} alto="1rem" />
          <Esqueleto ancho="12rem" alto="0.7rem" />
        </div>
      ))}
    </div>
  );
}
