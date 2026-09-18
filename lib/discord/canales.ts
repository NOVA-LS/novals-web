/**
 * Agrupar los canales de un servidor de Discord por su categoría.
 *
 * Módulo puro: no llama a Discord, solo ordena lo que ya se trajo. Así se
 * puede probar sin red, igual que `lib/discord/roles.ts`.
 */

const TIPO_TEXTO = 0;
const TIPO_CATEGORIA = 4;

export type CanalDiscord = {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
  position: number;
};

export type GrupoDeCanales = {
  categoria: { id: string; name: string };
  canales: { id: string; name: string }[];
};

/**
 * Solo entran los canales de texto que cuelgan de una categoría: la
 * selección en el panel es de dos pasos (categoría, luego canal), así que un
 * canal suelto o de otro tipo (voz, anuncios) no tiene dónde encajar.
 */
export function agruparPorCategoria(canales: CanalDiscord[]): GrupoDeCanales[] {
  const categorias = new Map(
    canales
      .filter((canal) => canal.type === TIPO_CATEGORIA)
      .sort((a, b) => a.position - b.position)
      .map((categoria) => [categoria.id, categoria]),
  );

  const grupos = new Map<string, GrupoDeCanales>();

  for (const canal of canales) {
    if (canal.type !== TIPO_TEXTO || !canal.parentId) continue;
    const categoria = categorias.get(canal.parentId);
    if (!categoria) continue;

    let grupo = grupos.get(categoria.id);
    if (!grupo) {
      grupo = { categoria: { id: categoria.id, name: categoria.name }, canales: [] };
      grupos.set(categoria.id, grupo);
    }
    grupo.canales.push({ id: canal.id, name: canal.name });
  }

  for (const grupo of grupos.values()) {
    const posiciones = new Map(canales.map((c) => [c.id, c.position]));
    grupo.canales.sort((a, b) => (posiciones.get(a.id) ?? 0) - (posiciones.get(b.id) ?? 0));
  }

  return [...categorias.values()]
    .filter((categoria) => grupos.has(categoria.id))
    .map((categoria) => grupos.get(categoria.id)!);
}
