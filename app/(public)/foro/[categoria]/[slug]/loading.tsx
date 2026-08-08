import { Cargando, Esqueleto } from "@/components/ui/esqueleto";

/** Un hilo se lee como una columna de mensajes: la silueta imita eso. */
export default function CargandoHilo() {
  return (
    <Cargando className="max-w-[62rem]">
      <Esqueleto ancho="60%" alto="2rem" />

      {[0, 1, 2].map((indice) => (
        <div key={indice} className="tile grid gap-[var(--space-sm)]">
          <div className="flex items-center gap-[var(--space-sm)]">
            <Esqueleto ancho="2rem" alto="2rem" className="rounded-full" />
            <Esqueleto ancho="9rem" alto="0.8rem" />
          </div>
          <Esqueleto alto="0.9rem" />
          <Esqueleto alto="0.9rem" />
          <Esqueleto ancho="70%" alto="0.9rem" />
        </div>
      ))}
    </Cargando>
  );
}
