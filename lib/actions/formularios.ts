"use server";

import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { ETIQUETA } from "@/lib/consultas";
import { ACCIONES, apuntar } from "@/lib/auditoria";
import { FORMS } from "@/lib/forms";
import {
  claveDeCampo,
  esquemaBorrador,
  huellaDeCampos,
  primerFallo,
} from "@/lib/forms/esquema";
import { traerForm, traerFormularios } from "@/lib/forms/registro";
import { Prisma } from "@/generated/prisma/client";
import type { Field } from "@/lib/forms/types";

export type ResultadoFormulario = { ok: boolean; mensaje?: string };

/** Lo que toca refrescar cuando un formulario cambia de forma o de estado. */
function refrescar(tipo: string) {
  updateTag(ETIQUETA.formularios);
  revalidatePath("/");
  revalidatePath("/formularios");
  revalidatePath(`/formularios/${tipo}`);
  revalidatePath("/panel/formularios");
  revalidatePath(`/panel/formularios/${tipo}`);
}

/**
 * Guarda el formulario entero: nombre, resumen y preguntas.
 *
 * La versión la decide el servidor y no el panel: sube cuando las preguntas
 * cambian y se queda quieta cuando solo se retoca el texto de presentación. Es
 * lo que permite mirar una solicitud vieja y saber a qué cuestionario contestó.
 */
export async function guardarFormulario(
  tipo: string,
  borrador: unknown,
): Promise<ResultadoFormulario> {
  const admin = await requireUser("ADMIN");

  const actual = await traerForm(tipo);
  if (!actual) return { ok: false, mensaje: "Ese formulario no existe." };

  const parsed = esquemaBorrador.safeParse(borrador);
  if (!parsed.success) {
    // Los enunciados salen del borrador tal cual llegó: es lo único que permite
    // decir en qué pregunta está el fallo cuando el esquema la ha rechazado.
    const campos = (borrador as { fields?: Field[] })?.fields;
    return { ok: false, mensaje: primerFallo(parsed.error, campos) };
  }

  const cambian =
    huellaDeCampos(parsed.data.fields as Field[]) !==
    huellaDeCampos(actual.fields);
  const version = actual.version + (cambian ? 1 : 0);

  const datos = {
    title: parsed.data.title,
    summary: parsed.data.summary,
    fields: parsed.data.fields as unknown as Prisma.InputJsonValue,
    version,
  };

  await db.formConfig.upsert({
    where: { type: tipo },
    update: datos,
    create: { type: tipo, ...datos },
  });

  await apuntar({
    accion: ACCIONES.FORMULARIO,
    actor: admin,
    objetivo: parsed.data.title,
    url: `/panel/formularios/${tipo}`,
    detalle: cambian
      ? `preguntas editadas · versión ${actual.version} → ${version}`
      : "texto editado",
  });

  refrescar(tipo);

  return {
    ok: true,
    mensaje: cambian
      ? `Guardado. Ahora es la versión ${version}.`
      : "Guardado.",
  };
}

/**
 * Crea un formulario que no tiene fichero detrás.
 *
 * Nace cerrado y sin preguntas: lo contrario sería publicar en la portada una
 * postulación vacía en el instante en que se le pone el nombre.
 */
export async function crearFormulario(
  titulo: string,
): Promise<ResultadoFormulario & { tipo?: string }> {
  const admin = await requireUser("ADMIN");

  const nombre = titulo.trim();
  if (nombre.length < 3) {
    return { ok: false, mensaje: "Ponle un nombre de al menos 3 letras." };
  }

  const existentes = await traerFormularios();
  const clave = claveDeCampo(
    nombre,
    existentes.map((form) => form.type),
  );

  const ultima = await db.formConfig.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await db.formConfig.create({
    data: {
      type: clave,
      open: false,
      title: nombre,
      summary: "Sin descripción todavía.",
      fields: [] as unknown as Prisma.InputJsonValue,
      version: 1,
      position: (ultima?.position ?? 0) + 1,
    },
  });

  await apuntar({
    accion: ACCIONES.FORMULARIO,
    actor: admin,
    objetivo: nombre,
    url: `/panel/formularios/${clave}`,
    detalle: "creado",
  });

  refrescar(clave);
  return { ok: true, tipo: clave };
}

/**
 * Copia un formulario entero —preguntas incluidas— con otro nombre.
 *
 * Nace cerrado, como uno creado de cero: duplicar no debe publicar de golpe
 * un cuestionario a medio adaptar.
 */
export async function duplicarFormulario(
  tipo: string,
  tituloNuevo: string,
): Promise<ResultadoFormulario & { tipo?: string }> {
  const admin = await requireUser("ADMIN");

  const origen = await traerForm(tipo);
  if (!origen) return { ok: false, mensaje: "Ese formulario no existe." };

  const nombre = tituloNuevo.trim();
  if (nombre.length < 3) {
    return { ok: false, mensaje: "Ponle un nombre de al menos 3 letras." };
  }

  const existentes = await traerFormularios();
  const clave = claveDeCampo(
    nombre,
    existentes.map((form) => form.type),
  );

  const ultima = await db.formConfig.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await db.formConfig.create({
    data: {
      type: clave,
      open: false,
      title: nombre,
      summary: origen.summary,
      fields: origen.fields as unknown as Prisma.InputJsonValue,
      version: 1,
      position: (ultima?.position ?? 0) + 1,
    },
  });

  await apuntar({
    accion: ACCIONES.FORMULARIO,
    actor: admin,
    objetivo: nombre,
    url: `/panel/formularios/${clave}`,
    detalle: `duplicado de ${origen.title}`,
  });

  refrescar(clave);
  return { ok: true, tipo: clave };
}

/**
 * Borra un formulario creado desde el panel.
 *
 * No se borran los que tienen fichero —volverían solos en el siguiente arranque—
 * ni los que ya han recibido solicitudes: dejarían las respuestas huérfanas, sin
 * manera de saber a qué contestaron. Para dejar de recibir, se cierra.
 */
export async function borrarFormulario(
  tipo: string,
): Promise<ResultadoFormulario> {
  const admin = await requireUser("ADMIN");

  if (FORMS[tipo]) {
    return {
      ok: false,
      mensaje: "Este viene con la web. Ciérralo si no quieres recibir más.",
    };
  }

  const recibidas = await db.submission.count({ where: { type: tipo } });
  if (recibidas > 0) {
    return {
      ok: false,
      mensaje: `Tiene ${recibidas} solicitud(es). Ciérralo en vez de borrarlo.`,
    };
  }

  const form = await traerForm(tipo);
  await db.formConfig.delete({ where: { type: tipo } });

  await apuntar({
    accion: ACCIONES.FORMULARIO,
    actor: admin,
    objetivo: form?.title ?? tipo,
    detalle: "borrado",
  });

  refrescar(tipo);
  return { ok: true };
}

/** Deshace las ediciones de un formulario del código y deja el del fichero. */
export async function restaurarFormulario(
  tipo: string,
): Promise<ResultadoFormulario> {
  const admin = await requireUser("ADMIN");

  const base = FORMS[tipo];
  if (!base) {
    return { ok: false, mensaje: "Este no tiene un original al que volver." };
  }

  await db.formConfig.update({
    where: { type: tipo },
    // `DbNull` y no `null`: en una columna JSON, null es un valor guardado.
    data: { title: null, summary: null, fields: Prisma.DbNull, version: null },
  });

  await apuntar({
    accion: ACCIONES.FORMULARIO,
    actor: admin,
    objetivo: base.title,
    url: `/panel/formularios/${tipo}`,
    detalle: "vuelto al original",
  });

  refrescar(tipo);
  return { ok: true };
}
