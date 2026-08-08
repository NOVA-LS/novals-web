"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { guardarFormulario } from "@/lib/actions/formularios";
import { claveDeCampo, huellaDeCampos } from "@/lib/forms/esquema";
import { guardarVistaBruta } from "@/lib/forms/vista-previa";
import type { Field, FormDefinition } from "@/lib/forms";
import { Boton } from "@/components/ui/button";

/**
 * El cuestionario, editable.
 *
 * Todo se lleva en memoria y se guarda de una vez al final: una pregunta a
 * medio escribir no es un formulario válido, así que ir salvando campo a campo
 * dejaría la web sirviendo cuestionarios rotos mientras alguien piensa.
 *
 * Lo que hay escrito se va dejando apuntado para la vista previa, que es otra
 * pantalla: así se puede ir a mirar cómo queda sin guardar antes.
 *
 * La clave de cada pregunta —con la que se guardan las respuestas— se calcula
 * del enunciado mientras la pregunta es nueva y se congela en cuanto se guarda:
 * cambiarla después dejaría las respuestas ya recibidas apuntando a una pregunta
 * que ya no existe.
 */

type Linea = { clave: string; nuevo: boolean; campo: Field };

/** Propiedades que tienen todas las preguntas, sean del tipo que sean. */
type Comunes = { label: string; help?: string; required?: boolean; name: string };

const TIPOS: { valor: Field["kind"]; texto: string }[] = [
  { valor: "text", texto: "Texto corto" },
  { valor: "textarea", texto: "Texto largo" },
  { valor: "number", texto: "Número" },
  { valor: "select", texto: "Lista de opciones" },
  { valor: "checkbox", texto: "Casilla" },
];

function lineasDe(campos: Field[]): Linea[] {
  return campos.map((campo) => ({ clave: campo.name, nuevo: false, campo }));
}

/** Un número de un input: vacío es «sin límite», no cero. */
function numero(valor: string): number | undefined {
  const limpio = valor.trim();
  if (!limpio) return undefined;
  const n = Number(limpio);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function texto(valor: number | undefined) {
  return valor === undefined ? "" : String(valor);
}

/**
 * Cambia el tipo de una pregunta conservando lo que sigue teniendo sentido.
 *
 * Los límites no se arrastran a propósito: un máximo de 4000 caracteres no
 * significa nada en un número, y arrastrarlo dejaría preguntas con reglas que
 * nadie escribió.
 */
function conTipo(campo: Field, kind: Field["kind"]): Field {
  const base = {
    name: campo.name,
    label: campo.label,
    help: campo.help,
    required: campo.required,
  };

  switch (kind) {
    case "textarea":
      return { ...base, kind, rows: 5 };
    case "select":
      return {
        ...base,
        kind,
        options:
          campo.kind === "select"
            ? campo.options
            : [{ value: "opcion_1", label: "Primera opción" }],
      };
    case "number":
      return { ...base, kind };
    case "checkbox":
      return { ...base, kind };
    default:
      return { ...base, kind: "text" };
  }
}

function nuevoCampo(ocupadas: string[]): Field {
  return {
    kind: "text",
    name: claveDeCampo("pregunta", ocupadas),
    label: "",
    required: true,
  };
}

export function EditorFormulario({
  form,
  recibidas,
}: {
  form: FormDefinition;
  /** Solicitudes ya guardadas con este cuestionario. */
  recibidas: number;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(form.title);
  const [resumen, setResumen] = useState(form.summary);
  const [lineas, setLineas] = useState<Linea[]>(() => lineasDe(form.fields));
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, empezar] = useTransition();

  const campos = lineas.map((linea) => linea.campo);
  const cambiadas = huellaDeCampos(campos) !== huellaDeCampos(form.fields);
  const sinGuardar =
    cambiadas || titulo !== form.title || resumen !== form.summary;

  // Lo de la pantalla, listo para que la vista previa lo recoja. Se apunta ya
  // serializado: así solo se vuelve a escribir cuando de verdad cambia algo.
  const paraLaVista = JSON.stringify({
    title: titulo,
    summary: resumen,
    fields: campos,
  });

  useEffect(() => {
    guardarVistaBruta(form.type, paraLaVista);
  }, [form.type, paraLaVista]);

  function cambiar(clave: string, hacer: (campo: Field) => Field) {
    setLineas((previas) =>
      previas.map((linea) =>
        linea.clave === clave ? { ...linea, campo: hacer(linea.campo) } : linea,
      ),
    );
    setAviso(null);
  }

  /** Lo que comparten todas las preguntas se toca sin mirar de qué tipo son. */
  function cambiarComun(clave: string, cambio: Partial<Comunes>) {
    cambiar(clave, (campo) => ({ ...campo, ...cambio }) as Field);
  }

  function cambiarEnunciado(clave: string, label: string) {
    setLineas((previas) =>
      previas.map((linea) => {
        if (linea.clave !== clave) return linea;

        // Mientras la pregunta no se haya guardado nunca, su clave sigue al
        // enunciado. Después ya no: hay respuestas que la usan.
        const name = linea.nuevo
          ? claveDeCampo(
              label,
              previas
                .filter((otra) => otra.clave !== clave)
                .map((otra) => otra.campo.name),
            )
          : linea.campo.name;

        return { ...linea, campo: { ...linea.campo, label, name } as Field };
      }),
    );
    setAviso(null);
  }

  function mover(indice: number, salto: -1 | 1) {
    const destino = indice + salto;
    if (destino < 0 || destino >= lineas.length) return;

    const copia = [...lineas];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    setLineas(copia);
    setAviso(null);
  }

  function añadir() {
    const clave = crypto.randomUUID();
    const campo = nuevoCampo(lineas.map((linea) => linea.campo.name));
    setLineas([...lineas, { clave, nuevo: true, campo }]);
    setAviso(null);
  }

  function quitar(clave: string) {
    setLineas(lineas.filter((linea) => linea.clave !== clave));
    setAviso(null);
  }

  function guardar() {
    setAviso(null);
    empezar(async () => {
      const resultado = await guardarFormulario(form.type, {
        title: titulo,
        summary: resumen,
        fields: campos,
      });

      if (resultado.ok) {
        // Ya están guardadas: sus claves quedan congeladas desde ahora.
        setLineas((previas) =>
          previas.map((linea) => ({ ...linea, nuevo: false })),
        );
        router.refresh();
      }

      setAviso({
        ok: resultado.ok,
        texto:
          resultado.mensaje ?? (resultado.ok ? "Guardado." : "No se pudo guardar."),
      });
    });
  }

  return (
    <div className="grid gap-[var(--space-md)]">
      <section className="tile grid gap-[var(--space-md)]">
        <div className="field">
          <label className="field__label" htmlFor="form-titulo">
            Nombre del formulario
          </label>
          <input
            id="form-titulo"
            className="input"
            value={titulo}
            maxLength={60}
            onChange={(evento) => {
              setTitulo(evento.target.value);
              setAviso(null);
            }}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="form-resumen">
            De qué va
          </label>
          <p className="field__help">
            Es lo que se lee en la tarjeta de postulaciones y arriba del
            cuestionario.
          </p>
          <textarea
            id="form-resumen"
            className="input"
            rows={3}
            maxLength={500}
            value={resumen}
            onChange={(evento) => {
              setResumen(evento.target.value);
              setAviso(null);
            }}
          />
        </div>
      </section>

      <div className="section-head section-head--fila">
        <h2 className="display text-(length:--text-lg)">
          Preguntas ({lineas.length})
        </h2>
        <Boton type="button" onClick={añadir}>
          <Plus size={15} aria-hidden />
          Añadir pregunta
        </Boton>
      </div>

      {lineas.length === 0 ? (
        <p className="tile text-sm text-[var(--color-muted)]">
          Todavía no hay ninguna. Un formulario sin preguntas no se puede
          enviar, así que déjalo cerrado hasta que tenga alguna.
        </p>
      ) : null}

      <ol className="grid gap-[var(--space-md)]">
        {lineas.map((linea, indice) => {
          const campo = linea.campo;
          const idBase = `campo-${linea.clave}`;

          return (
            <li
              key={linea.clave}
              className="tile grid gap-[var(--space-md)]"
              data-nuevo={linea.nuevo ? "true" : undefined}
            >
              <div className="flex flex-wrap items-start justify-between gap-[var(--space-sm)]">
                <span className="meta">
                  {indice + 1} · clave {campo.name}
                  {linea.nuevo ? " · nueva" : ""}
                </span>

                <div className="flex items-center gap-[var(--space-2xs)]">
                  <Boton
                    type="button"
                    variante="ghost"
                    aria-label="Subir la pregunta"
                    disabled={indice === 0}
                    onClick={() => mover(indice, -1)}
                  >
                    <ArrowUp size={15} aria-hidden />
                  </Boton>
                  <Boton
                    type="button"
                    variante="ghost"
                    aria-label="Bajar la pregunta"
                    disabled={indice === lineas.length - 1}
                    onClick={() => mover(indice, 1)}
                  >
                    <ArrowDown size={15} aria-hidden />
                  </Boton>
                  <Boton
                    type="button"
                    variante="danger"
                    aria-label="Quitar la pregunta"
                    onClick={() => quitar(linea.clave)}
                  >
                    <Trash2 size={15} aria-hidden />
                  </Boton>
                </div>
              </div>

              <div className="field">
                <label className="field__label" htmlFor={`${idBase}-label`}>
                  Enunciado
                </label>
                <input
                  id={`${idBase}-label`}
                  className="input"
                  value={campo.label}
                  maxLength={160}
                  placeholder="¿Qué se le pregunta?"
                  onChange={(evento) =>
                    cambiarEnunciado(linea.clave, evento.target.value)
                  }
                />
              </div>

              <div className="grid gap-[var(--space-md)] sm:grid-cols-2">
                <div className="field">
                  <label className="field__label" htmlFor={`${idBase}-tipo`}>
                    Tipo de respuesta
                  </label>
                  <select
                    id={`${idBase}-tipo`}
                    className="input"
                    value={campo.kind}
                    onChange={(evento) =>
                      cambiar(linea.clave, (actual) =>
                        conTipo(actual, evento.target.value as Field["kind"]),
                      )
                    }
                  >
                    {TIPOS.map((tipo) => (
                      <option key={tipo.valor} value={tipo.valor}>
                        {tipo.texto}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field__label" htmlFor={`${idBase}-ayuda`}>
                    Aclaración
                  </label>
                  <input
                    id={`${idBase}-ayuda`}
                    className="input"
                    value={campo.help ?? ""}
                    maxLength={300}
                    placeholder="Opcional: se lee bajo el enunciado"
                    onChange={(evento) =>
                      cambiarComun(linea.clave, {
                        help: evento.target.value || undefined,
                      })
                    }
                  />
                </div>
              </div>

              {/* Los límites, distintos según lo que se pida. */}
              {campo.kind === "text" || campo.kind === "textarea" ? (
                <div className="grid gap-[var(--space-md)] sm:grid-cols-3">
                  <div className="field">
                    <label className="field__label" htmlFor={`${idBase}-min`}>
                      Mínimo de caracteres
                    </label>
                    <input
                      id={`${idBase}-min`}
                      className="input"
                      type="number"
                      min={0}
                      value={texto(campo.minLength)}
                      onChange={(evento) =>
                        cambiar(linea.clave, (actual) =>
                          actual.kind === "text" || actual.kind === "textarea"
                            ? { ...actual, minLength: numero(evento.target.value) }
                            : actual,
                        )
                      }
                    />
                  </div>

                  <div className="field">
                    <label className="field__label" htmlFor={`${idBase}-max`}>
                      Máximo
                    </label>
                    <input
                      id={`${idBase}-max`}
                      className="input"
                      type="number"
                      min={0}
                      value={texto(campo.maxLength)}
                      onChange={(evento) =>
                        cambiar(linea.clave, (actual) =>
                          actual.kind === "text" || actual.kind === "textarea"
                            ? { ...actual, maxLength: numero(evento.target.value) }
                            : actual,
                        )
                      }
                    />
                  </div>

                  <div className="field">
                    <label className="field__label" htmlFor={`${idBase}-pista`}>
                      Texto de ejemplo
                    </label>
                    <input
                      id={`${idBase}-pista`}
                      className="input"
                      value={campo.placeholder ?? ""}
                      maxLength={120}
                      onChange={(evento) =>
                        cambiar(linea.clave, (actual) =>
                          actual.kind === "text" || actual.kind === "textarea"
                            ? {
                                ...actual,
                                placeholder: evento.target.value || undefined,
                              }
                            : actual,
                        )
                      }
                    />
                  </div>
                </div>
              ) : null}

              {campo.kind === "number" ? (
                <div className="grid gap-[var(--space-md)] sm:grid-cols-2">
                  <div className="field">
                    <label className="field__label" htmlFor={`${idBase}-nmin`}>
                      Valor mínimo
                    </label>
                    <input
                      id={`${idBase}-nmin`}
                      className="input"
                      type="number"
                      value={texto(campo.min)}
                      onChange={(evento) =>
                        cambiar(linea.clave, (actual) =>
                          actual.kind === "number"
                            ? { ...actual, min: numero(evento.target.value) }
                            : actual,
                        )
                      }
                    />
                  </div>

                  <div className="field">
                    <label className="field__label" htmlFor={`${idBase}-nmax`}>
                      Valor máximo
                    </label>
                    <input
                      id={`${idBase}-nmax`}
                      className="input"
                      type="number"
                      value={texto(campo.max)}
                      onChange={(evento) =>
                        cambiar(linea.clave, (actual) =>
                          actual.kind === "number"
                            ? { ...actual, max: numero(evento.target.value) }
                            : actual,
                        )
                      }
                    />
                  </div>
                </div>
              ) : null}

              {campo.kind === "select" ? (
                <Opciones
                  campo={campo}
                  idBase={idBase}
                  nuevo={linea.nuevo}
                  alCambiar={(opciones) =>
                    cambiar(linea.clave, (actual) =>
                      actual.kind === "select"
                        ? { ...actual, options: opciones }
                        : actual,
                    )
                  }
                />
              ) : null}

              <label className="flex items-center gap-[var(--space-xs)] text-sm text-[var(--color-muted)]">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-ink)]"
                  checked={campo.required ?? true}
                  onChange={(evento) =>
                    cambiarComun(linea.clave, { required: evento.target.checked })
                  }
                />
                Obligatoria
              </label>
            </li>
          );
        })}
      </ol>

      {/* La barra de guardar se queda a la vista: con veinte preguntas, el
          final de la lista queda muy lejos del sitio donde se estaba. */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-[var(--space-md)] border-t border-[var(--color-rule)] bg-[var(--color-paper)] py-[var(--space-md)]">
        <Boton
          type="button"
          variante="primary"
          onClick={guardar}
          disabled={guardando || !sinGuardar}
          data-state={guardando ? "loading" : undefined}
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </Boton>

        <span className="meta">
          {sinGuardar
            ? cambiadas
              ? `Las preguntas cambian: pasará a la versión ${form.version + 1}`
              : "Sin guardar"
            : `Versión ${form.version} · al día`}
        </span>

        {aviso ? (
          <span
            className={
              aviso.ok
                ? "text-sm text-[var(--color-accepted)]"
                : "field__error"
            }
            role="status"
          >
            {aviso.texto}
          </span>
        ) : null}
      </div>

      {recibidas > 0 && cambiadas ? (
        <p className="meta">
          Ya hay {recibidas} solicitud(es) enviadas. Las guardadas conservan la
          versión con la que se contestaron, así que seguirán leyéndose igual.
        </p>
      ) : null}
    </div>
  );
}

/** Una opción recién puesta, a la que nadie ha cambiado el texto todavía. */
const SIN_TOCAR = /^opcion_\d+$/;

/**
 * Las opciones de una lista.
 *
 * La clave de cada una es lo que queda guardado en las respuestas, así que sigue
 * al texto solo mientras la opción es nueva: en una pregunta que ya se ha
 * enviado, retocar el enunciado de una opción no puede cambiar aquello a lo que
 * contestó la gente.
 */
function Opciones({
  campo,
  idBase,
  nuevo,
  alCambiar,
}: {
  campo: Extract<Field, { kind: "select" }>;
  idBase: string;
  /** La pregunta entera es nueva: nada de esto se ha guardado aún. */
  nuevo: boolean;
  alCambiar: (opciones: { value: string; label: string }[]) => void;
}) {
  const claves = campo.options.map((opcion) => opcion.value);

  return (
    <div className="field">
      <span className="field__label">Opciones</span>

      <ul className="grid gap-[var(--space-xs)]">
        {campo.options.map((opcion, indice) => (
          <li key={indice} className="flex items-center gap-[var(--space-xs)]">
            <input
              className="input"
              aria-label={`Opción ${indice + 1}`}
              id={`${idBase}-opcion-${indice}`}
              value={opcion.label}
              maxLength={80}
              onChange={(evento) => {
                const label = evento.target.value;
                const sigueAlTexto = nuevo || SIN_TOCAR.test(opcion.value);
                const otras = claves.filter((_, i) => i !== indice);

                alCambiar(
                  campo.options.map((otra, i) =>
                    i === indice
                      ? {
                          value: sigueAlTexto
                            ? claveDeCampo(label, otras, "opcion")
                            : otra.value,
                          label,
                        }
                      : otra,
                  ),
                );
              }}
            />
            <Boton
              type="button"
              variante="ghost"
              aria-label="Quitar la opción"
              disabled={campo.options.length === 1}
              onClick={() =>
                alCambiar(campo.options.filter((_, i) => i !== indice))
              }
            >
              <Trash2 size={15} aria-hidden />
            </Boton>
          </li>
        ))}
      </ul>

      <div>
        <Boton
          type="button"
          onClick={() =>
            alCambiar([
              ...campo.options,
              {
                value: claveDeCampo(`opcion ${campo.options.length + 1}`, claves),
                label: `Opción ${campo.options.length + 1}`,
              },
            ])
          }
        >
          <Plus size={15} aria-hidden />
          Añadir opción
        </Boton>
      </div>
    </div>
  );
}
