import {
  Cargando,
  EsqueletoCabecera,
  EsqueletoLista,
} from "@/components/ui/esqueleto";

/**
 * Carga de cualquier pantalla pública que no tenga la suya.
 *
 * Todas las páginas van con `force-dynamic`, así que entre pulsar un enlace y
 * ver la página hay una consulta de por medio. Sin esto, ese hueco es la
 * pantalla anterior congelada y parece que no se ha pulsado nada.
 */
export default function CargandoPublico() {
  return (
    <Cargando>
      <EsqueletoCabecera />
      <EsqueletoLista filas={6} />
    </Cargando>
  );
}
