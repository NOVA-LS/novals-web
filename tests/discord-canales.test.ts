import { describe, expect, it } from "vitest";
import { agruparPorCategoria, type CanalDiscord } from "@/lib/discord/canales";

const TIPO_TEXTO = 0;
const TIPO_CATEGORIA = 4;

describe("agruparPorCategoria", () => {
  it("mete cada canal de texto bajo su categoría", () => {
    const canales: CanalDiscord[] = [
      { id: "cat1", name: "Comunidad", type: TIPO_CATEGORIA, parentId: null, position: 0 },
      { id: "c1", name: "anuncios", type: TIPO_TEXTO, parentId: "cat1", position: 0 },
      { id: "c2", name: "eventos", type: TIPO_TEXTO, parentId: "cat1", position: 1 },
    ];

    expect(agruparPorCategoria(canales)).toEqual([
      {
        categoria: { id: "cat1", name: "Comunidad" },
        canales: [
          { id: "c1", name: "anuncios" },
          { id: "c2", name: "eventos" },
        ],
      },
    ]);
  });

  it("ordena categorías y canales por su posición en Discord", () => {
    const canales: CanalDiscord[] = [
      { id: "cat2", name: "Segunda", type: TIPO_CATEGORIA, parentId: null, position: 1 },
      { id: "cat1", name: "Primera", type: TIPO_CATEGORIA, parentId: null, position: 0 },
      { id: "c3", name: "c", type: TIPO_TEXTO, parentId: "cat2", position: 0 },
      { id: "c2", name: "b", type: TIPO_TEXTO, parentId: "cat1", position: 1 },
      { id: "c1", name: "a", type: TIPO_TEXTO, parentId: "cat1", position: 0 },
    ];

    const resultado = agruparPorCategoria(canales);
    expect(resultado.map((g) => g.categoria.id)).toEqual(["cat1", "cat2"]);
    expect(resultado[0].canales.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("deja fuera canales de voz y de anuncios: no son de texto normal", () => {
    const canales: CanalDiscord[] = [
      { id: "cat1", name: "Comunidad", type: TIPO_CATEGORIA, parentId: null, position: 0 },
      { id: "voz", name: "sala", type: 2, parentId: "cat1", position: 0 },
      { id: "c1", name: "anuncios", type: TIPO_TEXTO, parentId: "cat1", position: 1 },
    ];

    expect(agruparPorCategoria(canales)).toEqual([
      { categoria: { id: "cat1", name: "Comunidad" }, canales: [{ id: "c1", name: "anuncios" }] },
    ]);
  });

  it("descarta canales de texto sin categoría: no hay dónde agruparlos", () => {
    const canales: CanalDiscord[] = [
      { id: "suelto", name: "general", type: TIPO_TEXTO, parentId: null, position: 0 },
    ];

    expect(agruparPorCategoria(canales)).toEqual([]);
  });

  it("omite categorías vacías: no aportan ningún canal elegible", () => {
    const canales: CanalDiscord[] = [
      { id: "cat1", name: "Vacía", type: TIPO_CATEGORIA, parentId: null, position: 0 },
    ];

    expect(agruparPorCategoria(canales)).toEqual([]);
  });
});
