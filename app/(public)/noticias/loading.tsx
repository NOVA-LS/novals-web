import {
  Cargando,
  EsqueletoCabecera,
  EsqueletoTarjetas,
} from "@/components/ui/esqueleto";

export default function CargandoNoticias() {
  return (
    <Cargando>
      <EsqueletoCabecera />
      <EsqueletoTarjetas cuantas={6} conImagen />
    </Cargando>
  );
}
