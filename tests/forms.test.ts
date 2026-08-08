import { describe, expect, it } from "vitest";
import {
  FORMS,
  answersFromFormData,
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
  version: 1,
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
