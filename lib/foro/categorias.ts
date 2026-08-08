/**
 * Categorías del foro.
 *
 * Viven en código y no en base de datos: son pocas, cambian casi nunca, y así
 * añadir una es editar este archivo en vez de montarle una pantalla al panel.
 */

export type Categoria = {
  slug: string;
  nombre: string;
  descripcion: string;
  /** Nombre de un icono de lucide-react */
  icono: string;
};

export const CATEGORIAS: Categoria[] = [
  {
    slug: "presentaciones",
    nombre: "Presentaciones",
    descripcion: "Preséntate y cuenta a quién vas a interpretar en la ciudad.",
    icono: "Hand",
  },
  {
    slug: "ideas",
    nombre: "Ideas",
    descripcion:
      "Cosas que todavía no existen: un evento, un negocio, una trama que montar.",
    icono: "Lightbulb",
  },
  {
    slug: "mejoras",
    nombre: "Mejoras",
    descripcion:
      "Sobre lo que ya hay: qué se queda corto y cómo lo arreglarías. Concreto mejor que grandilocuente.",
    icono: "Wrench",
  },
];

export function getCategoria(slug: string): Categoria | undefined {
  return CATEGORIAS.find((categoria) => categoria.slug === slug);
}
