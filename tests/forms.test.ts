import { describe, expect, it } from "vitest";
import {
  FORMS,
  answersFromFormData,
  esPregunta,
  getForm,
  schemaFor,
  type FormDefinition,
} from "@/lib/forms";
import { slugify } from "@/lib/utils";

function formData(valores: Record<string, string>) {
  const datos = new FormData();
  for (const [clave, valor] of Object.entries(valores)) datos.set(clave, valor);
  return datos;
}

/**
 * Un cuestionario de mentira con los cinco tipos de pregunta.
 *
 * Antes se probaba contra la whitelist, que estaba escrita en el código. Ahora
 * los formularios se montan desde el panel y no hay ninguno fijo, así que la
 * prueba se trae el suyo: lo que se comprueba es el motor, no un formulario
 * concreto que mañana puede tener otras preguntas.
 */
const form: FormDefinition = {
  type: "prueba",
  title: "Prueba",
  summary: "Uno de cada tipo de pregunta.",
  fields: [
    { name: "edad", kind: "number", label: "Edad", min: 14, max: 99 },
    {
      name: "experiencia",
      kind: "select",
      label: "Experiencia",
      options: [
        { value: "poca", label: "Poca" },
        { value: "media", label: "Media" },
      ],
    },
    {
      name: "servidores_previos",
      kind: "text",
      label: "Servidores anteriores",
      required: false,
      maxLength: 200,
    },
    {
      name: "metagaming",
      kind: "textarea",
      label: "¿Qué es el metagaming?",
      minLength: 80,
      maxLength: 1000,
    },
    { name: "normativa", kind: "checkbox", label: "Acepto la normativa" },
  ],
};

/**
 * Un segundo formulario con los tipos de campo que no son preguntas de toda
 * la vida: bloques sin respuesta, subida de archivo, fecha y lista múltiple.
 */
const formAmpliado: FormDefinition = {
  type: "prueba_ampliada",
  title: "Prueba ampliada",
  summary: "Los tipos de campo nuevos.",
  fields: [
    { name: "intro", kind: "seccion", label: "Antes de empezar" },
    { name: "nota", kind: "texto", label: "", help: "Lee esto con calma." },
    { name: "cuidado", kind: "aviso", label: "Importante", help: "No mientas." },
    { name: "documento", kind: "file", label: "Sube tu DNI" },
    { name: "nacimiento", kind: "date", label: "Fecha de nacimiento" },
    {
      name: "colores",
      kind: "select",
      label: "Colores favoritos",
      multiple: true,
      options: [
        { value: "rojo", label: "Rojo" },
        { value: "azul", label: "Azul" },
        { value: "verde", label: "Verde" },
      ],
    },
  ],
};

describe("registro de formularios del código", () => {
  it("está indexado por su propio type", () => {
    for (const [clave, definicion] of Object.entries(FORMS)) {
      expect(clave).toBe(definicion.type);
      expect(getForm(clave)).toBe(definicion);
    }
  });

  it("no inventa uno que no existe", () => {
    expect(getForm("no_existe")).toBeUndefined();
  });
});

describe("schemaFor", () => {
  const schema = schemaFor(form);

  const respuestasValidas = {
    edad: "22",
    experiencia: "media",
    servidores_previos: "",
    metagaming: "a".repeat(90),
    normativa: "on",
  };

  it("acepta un envío completo", () => {
    const parsed = schema.safeParse(
      answersFromFormData(form, formData(respuestasValidas)),
    );
    expect(parsed.success).toBe(true);
  });

  it("rechaza un texto por debajo del mínimo", () => {
    const parsed = schema.safeParse(
      answersFromFormData(
        form,
        formData({ ...respuestasValidas, metagaming: "corto" }),
      ),
    );

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === "metagaming")).toBe(true);
    }
  });

  it("rechaza una edad fuera de rango", () => {
    const parsed = schema.safeParse(
      answersFromFormData(form, formData({ ...respuestasValidas, edad: "9" })),
    );
    expect(parsed.success).toBe(false);
  });

  it("rechaza una opción que no está en la lista", () => {
    const parsed = schema.safeParse(
      answersFromFormData(
        form,
        formData({ ...respuestasValidas, experiencia: "inventada" }),
      ),
    );
    expect(parsed.success).toBe(false);
  });

  it("exige marcar la casilla obligatoria", () => {
    const datos = formData(respuestasValidas);
    datos.delete("normativa");

    const parsed = schema.safeParse(answersFromFormData(form, datos));
    expect(parsed.success).toBe(false);
  });

  it("deja pasar un campo opcional vacío", () => {
    const parsed = schema.safeParse(
      answersFromFormData(
        form,
        formData({ ...respuestasValidas, servidores_previos: "" }),
      ),
    );
    expect(parsed.success).toBe(true);
  });
});

describe("esPregunta", () => {
  it("descarta sección, texto y aviso", () => {
    expect(formAmpliado.fields.filter(esPregunta).map((f) => f.name)).toEqual([
      "documento",
      "nacimiento",
      "colores",
    ]);
  });
});

describe("schemaFor con los tipos nuevos", () => {
  const schema = schemaFor(formAmpliado);

  const validas = {
    documento: "https://x/subidas/dni.pdf",
    nacimiento: "2005-03-14",
    colores: ["rojo", "azul"],
  };

  it("acepta un envío completo, sin pedir nada de sección/texto/aviso", () => {
    const parsed = schema.safeParse(validas);
    expect(parsed.success).toBe(true);
  });

  it("no incluye sección, texto ni aviso en el shape", () => {
    expect(Object.keys(schema.shape)).toEqual(["documento", "nacimiento", "colores"]);
  });

  it("exige el archivo cuando el campo es obligatorio", () => {
    const parsed = schema.safeParse({ ...validas, documento: "" });
    expect(parsed.success).toBe(false);
  });

  it("rechaza una fecha con formato inválido", () => {
    const parsed = schema.safeParse({ ...validas, nacimiento: "14-03-2005" });
    expect(parsed.success).toBe(false);
  });

  it("exige al menos una opción cuando la lista múltiple es obligatoria", () => {
    const parsed = schema.safeParse({ ...validas, colores: [] });
    expect(parsed.success).toBe(false);
  });

  it("rechaza una opción que no está en la lista, dentro de la múltiple", () => {
    const parsed = schema.safeParse({ ...validas, colores: ["morado"] });
    expect(parsed.success).toBe(false);
  });
});

describe("answersFromFormData con los tipos nuevos", () => {
  it("no lee nada de sección, texto ni aviso", () => {
    const datos = formData({ nacimiento: "2005-03-14" });
    const raw = answersFromFormData(formAmpliado, datos);
    expect(raw).not.toHaveProperty("intro");
    expect(raw).not.toHaveProperty("nota");
    expect(raw).not.toHaveProperty("cuidado");
  });

  it("tampoco lee el archivo: lo resuelve quien llama, no este helper", () => {
    const datos = formData({ nacimiento: "2005-03-14" });
    expect(answersFromFormData(formAmpliado, datos)).not.toHaveProperty("documento");
  });

  it("lee la lista múltiple como array con getAll", () => {
    const datos = new FormData();
    datos.set("nacimiento", "2005-03-14");
    datos.append("colores", "rojo");
    datos.append("colores", "verde");

    const raw = answersFromFormData(formAmpliado, datos);
    expect(raw.colores).toEqual(["rojo", "verde"]);
  });
});

describe("slugify", () => {
  it("quita acentos y símbolos", () => {
    expect(slugify("Apertura de la ciudad: ¡edición Ñ!")).toBe(
      "apertura-de-la-ciudad-edicion-n",
    );
  });

  it("no deja guiones sueltos en los extremos", () => {
    expect(slugify("  --Hola--  ")).toBe("hola");
  });
});
