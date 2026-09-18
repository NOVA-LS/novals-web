import { describe, expect, it } from "vitest";
import { FORMS, schemaFor } from "@/lib/forms";
import {
  claveDeCampo,
  definicionGuardada,
  esquemaBorrador,
  huellaDeCampos,
  primerFallo,
} from "@/lib/forms/esquema";
import type { Field } from "@/lib/forms/types";

const edad: Extract<Field, { kind: "number" }> = {
  name: "edad",
  kind: "number",
  label: "Edad",
  min: 14,
  max: 99,
};

const campos: Field[] = [
  edad,
  {
    name: "color",
    kind: "select",
    label: "Color favorito",
    options: [
      { value: "rojo", label: "Rojo" },
      { value: "azul", label: "Azul" },
    ],
  },
];

const borrador = { title: "Prueba", summary: "Un formulario de prueba", fields: campos };

describe("esquema de un formulario guardado", () => {
  it("acepta uno bien formado", () => {
    expect(esquemaBorrador.safeParse(borrador).success).toBe(true);
  });

  it("rechaza dos preguntas con la misma clave", () => {
    const repetido = { ...borrador, fields: [edad, { ...edad }] };
    const parsed = esquemaBorrador.safeParse(repetido);

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toContain("edad");
    }
  });

  it("rechaza una clave que no sirve como nombre de campo", () => {
    const malo = {
      ...borrador,
      fields: [{ ...edad, name: "3 años" }],
    };
    expect(esquemaBorrador.safeParse(malo).success).toBe(false);
  });

  it("rechaza un mínimo por encima del máximo", () => {
    const alReves = {
      ...borrador,
      fields: [{ ...edad, min: 40, max: 20 }],
    };
    expect(esquemaBorrador.safeParse(alReves).success).toBe(false);
  });

  it("rechaza una lista de opciones vacía", () => {
    const sinOpciones = {
      ...borrador,
      fields: [{ ...campos[1], options: [] }],
    };
    expect(esquemaBorrador.safeParse(sinOpciones).success).toBe(false);
  });

  it("acepta sección, texto y aviso sin campo obligatorio", () => {
    const conBloques = {
      ...borrador,
      fields: [
        edad,
        { name: "intro", kind: "seccion" as const, label: "Antes de nada" },
        { name: "nota", kind: "texto" as const, label: "", help: "Ojo con esto." },
        { name: "cuidado", kind: "aviso" as const, label: "Aviso", help: "No copies." },
      ],
    };
    expect(esquemaBorrador.safeParse(conBloques).success).toBe(true);
  });

  it("acepta un campo de fecha con mínimo y máximo en orden", () => {
    const conFecha = {
      ...borrador,
      fields: [
        {
          name: "cuando",
          kind: "date" as const,
          label: "¿Cuándo?",
          min: "2020-01-01",
          max: "2020-12-31",
        },
      ],
    };
    expect(esquemaBorrador.safeParse(conFecha).success).toBe(true);
  });

  it("rechaza una fecha con el mínimo por encima del máximo", () => {
    const alReves = {
      ...borrador,
      fields: [
        {
          name: "cuando",
          kind: "date" as const,
          label: "¿Cuándo?",
          min: "2020-12-31",
          max: "2020-01-01",
        },
      ],
    };
    expect(esquemaBorrador.safeParse(alReves).success).toBe(false);
  });

  it("acepta un campo de subir archivo", () => {
    const conArchivo = {
      ...borrador,
      fields: [{ name: "doc", kind: "file" as const, label: "Sube tu documento" }],
    };
    expect(esquemaBorrador.safeParse(conArchivo).success).toBe(true);
  });

  it("acepta una lista de opciones marcada como múltiple", () => {
    const multiple = {
      ...borrador,
      fields: [{ ...campos[1], multiple: true }],
    };
    expect(esquemaBorrador.safeParse(multiple).success).toBe(true);
  });

  it("acepta una lista de opciones marcada para verse en casillas", () => {
    const radios = {
      ...borrador,
      fields: [{ ...campos[1], radios: true }],
    };
    expect(esquemaBorrador.safeParse(radios).success).toBe(true);
  });

  it("dice en qué pregunta está el fallo", () => {
    const parsed = esquemaBorrador.safeParse({
      ...borrador,
      fields: [edad, { ...campos[1], options: [] }],
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(primerFallo(parsed.error, borrador.fields)).toContain(
        "Color favorito",
      );
    }
  });

  it("una definición del código pasa por el mismo esquema", () => {
    // Si dejaran de encajar, el editor no podría abrir los que vienen de fábrica.
    for (const form of Object.values(FORMS)) {
      const parsed = esquemaBorrador.safeParse({
        title: form.title,
        summary: form.summary,
        fields: form.fields,
      });
      expect(parsed.success, form.type).toBe(true);
    }
  });
});

describe("definicionGuardada", () => {
  it("devuelve la definición cuando se sostiene", () => {
    const leida = definicionGuardada({ type: "prueba", ...borrador });
    expect(leida?.fields).toHaveLength(2);
  });

  it("devuelve null con una fila corrupta, para poder caer al fichero", () => {
    expect(definicionGuardada({ type: "prueba" })).toBeNull();
    expect(definicionGuardada("no es un formulario")).toBeNull();
    expect(
      definicionGuardada({ ...borrador, type: "prueba", fields: [{}] }),
    ).toBeNull();
  });

  it("lo que sale del esquema se puede validar como cuestionario", () => {
    const leida = definicionGuardada({ type: "prueba", ...borrador })!;
    const parsed = schemaFor(leida).safeParse({ edad: "20", color: "azul" });
    expect(parsed.success).toBe(true);
  });
});

describe("huellaDeCampos", () => {
  it("no ve cambio cuando solo cambia el orden de las propiedades", () => {
    const alReves: Field[] = [
      { max: 99, min: 14, label: "Edad", kind: "number", name: "edad" },
    ];
    expect(huellaDeCampos(alReves)).toBe(huellaDeCampos([edad]));
  });

  it("ve cambio cuando cambia un límite", () => {
    expect(huellaDeCampos([{ ...edad, max: 80 }])).not.toBe(huellaDeCampos([edad]));
  });

  it("ve cambio cuando se añade una pregunta", () => {
    expect(huellaDeCampos(campos)).not.toBe(huellaDeCampos([edad]));
  });
});

describe("claveDeCampo", () => {
  it("saca una clave usable de un enunciado cualquiera", () => {
    expect(claveDeCampo("¿Qué es el metagaming?", [])).toBe("que_es_el_metagaming");
  });

  it("no repite una que ya está ocupada", () => {
    expect(claveDeCampo("Edad", ["edad"])).toBe("edad_2");
    expect(claveDeCampo("Edad", ["edad", "edad_2"])).toBe("edad_3");
  });

  it("no deja que empiece por número", () => {
    expect(claveDeCampo("3 servidores", [])).toBe("p_3_servidores");
  });

  it("tira del respaldo cuando el texto no da ninguna letra", () => {
    expect(claveDeCampo("¿?", [], "opcion")).toBe("opcion");
  });
});
