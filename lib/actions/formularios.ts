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
  huellaFormulario,
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

/** Guarda el formulario entero: nombre, resumen y preguntas. */
export async function guardarFormulario(
  tipo: string,
  borrador: unknown,
  /**
   * Huella del formulario tal como lo vio el editor al cargar o al último
   * guardado con éxito. Si ya no coincide con lo que hay en la base, alguien
   * más ha guardado por medio y este guardado se rechaza en vez de pisarlo.
   */
  huellaBase?: string,
): Promise<ResultadoFormulario> {
  const admin = await requireUser("ADMIN");

  const actual = await traerForm(tipo);
  if (!actual) return { ok: false, mensaje: "Ese formulario no existe." };

  if (huellaBase !== undefined && huellaBase !== huellaFormulario(actual)) {
    return {
      ok: false,
      mensaje: "Alguien más ha editado este formulario mientras tanto. Recarga la página.",
    };
  }

  const parsed = esquemaBorrador.safeParse(borrador);
  if (!parsed.success) {
    // Los enunciados salen del borrador tal cual llegó: es lo único que permite
    // decir en qué pregunta está el fallo cuando el esquema la ha rechazado.
    const campos = (borrador as { fields?: Field[] })?.fields;
    return { ok: false, mensaje: primerFallo(parsed.error, campos) };
  }

  // Solo para el registro de auditoría y el aviso de abajo: no cambia nada de
  // lo que se guarda.
  const cambian =
    huellaDeCampos(parsed.data.fields as Field[]) !==
    huellaDeCampos(actual.fields);

  const datos = {
    title: parsed.data.title,
    summary: parsed.data.summary,
    fields: parsed.data.fields as unknown as Prisma.InputJsonValue,
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
    detalle: cambian ? "preguntas editadas" : "texto editado",
  });

  refrescar(tipo);

  return { ok: true, mensaje: "Guardado." };
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

  // find+create en una sola transacción: sin esto, dos formularios creados a
  // la vez pueden leer la misma última posición y acabar compartiéndola.
  await db.$transaction(async (tx) => {
    const ultima = await tx.formConfig.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });

    await tx.formConfig.create({
      data: {
        type: clave,
        open: false,
        title: nombre,
        summary: "Sin descripción todavía.",
        fields: [] as unknown as Prisma.InputJsonValue,
        position: (ultima?.position ?? 0) + 1,
      },
    });
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

  // find+create en una sola transacción: sin esto, dos formularios creados a
  // la vez pueden leer la misma última posición y acabar compartiéndola.
  await db.$transaction(async (tx) => {
    const ultima = await tx.formConfig.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });

    await tx.formConfig.create({
      data: {
        type: clave,
        open: false,
        title: nombre,
        summary: origen.summary,
        fields: origen.fields as unknown as Prisma.InputJsonValue,
        position: (ultima?.position ?? 0) + 1,
      },
    });
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
    data: { title: null, summary: null, fields: Prisma.DbNull },
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
