import {
  Cargando,
  Esqueleto,
  EsqueletoCabecera,
  EsqueletoLista,
} from "@/components/ui/esqueleto";

/** Carga de cualquier pantalla del panel: cabecera, cifras y una lista. */
export default function CargandoPanel() {
  return (
    <Cargando>
      <EsqueletoCabecera />

      <div className="flex flex-wrap gap-[var(--space-lg)]">
        {[0, 1, 2, 3].map((indice) => (
          <div key={indice} className="grid gap-[var(--space-2xs)]">
            <Esqueleto ancho="3rem" alto="1.6rem" />
            <Esqueleto ancho="6rem" alto="0.7rem" />
          </div>
        ))}
      </div>

      <EsqueletoLista filas={6} />
    </Cargando>
  );
}
