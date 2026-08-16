"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { guardarFormulario } from "@/lib/actions/formularios";
import { claveDeCampo, huellaDeCampos, huellaFormulario } from "@/lib/forms/esquema";
import { guardarVistaBruta, leerVistaBruta } from "@/lib/forms/vista-previa";
import { esPregunta, type Field, type FormDefinition } from "@/lib/forms";
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

/**
 * Con qué se puede montar una pregunta nueva.
 *
 * "checkbox" (la casilla suelta de sí/no) no está: "Lista de opciones" con una
 * sola opción y en casillas hace lo mismo y más. Las preguntas que ya son de
 * ese tipo se siguen viendo y editando bien —ver `opcionesDeTipo` más abajo—,
 * solo que no se puede crear ninguna nueva.
 */
const TIPOS: { valor: Field["kind"]; texto: string }[] = [
  { valor: "text", texto: "Texto corto" },
  { valor: "textarea", texto: "Texto largo" },
  { valor: "number", texto: "Número" },
  { valor: "date", texto: "Fecha" },
  { valor: "select", texto: "Lista de opciones" },
  { valor: "file", texto: "Subir PDF" },
  { valor: "seccion", texto: "Sección" },
  { valor: "texto", texto: "Texto informativo" },
  { valor: "aviso", texto: "Aviso destacado" },
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
        multiple: campo.kind === "select" ? campo.multiple : undefined,
        radios: campo.kind === "select" ? campo.radios : undefined,
      };
    case "number":
      return { ...base, kind };
    case "date":
      return { ...base, kind };
    case "checkbox":
      return { ...base, kind };
    case "file":
      return { ...base, kind };
    // Sin required: no son preguntas, no tiene sentido pedir obligatoriedad.
    case "seccion":
      return { name: base.name, label: base.label, help: base.help, kind };
    case "texto":
      return { name: base.name, label: base.label, help: base.help, kind };
    case "aviso":
      return { name: base.name, label: base.label, help: base.help, kind };
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
  clavesHistoricas,
}: {
  form: FormDefinition;
  /** Solicitudes ya guardadas con este cuestionario. */
  recibidas: number;
  /**
   * Claves que alguna vez han quedado guardadas en una respuesta de este
   * formulario, aunque la pregunta que las usaba ya no exista. Una pregunta
   * nueva no puede recibir ninguna de estas: si lo hiciera, las respuestas
   * viejas guardadas con esa clave se leerían como si fueran suyas.
   */
  clavesHistoricas: string[];
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(form.title);
  const [resumen, setResumen] = useState(form.summary);
  const [lineas, setLineas] = useState<Linea[]>(() => lineasDe(form.fields));
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, empezar] = useTransition();
  const restaurado = useRef(false);

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

  // Recupera lo que hubiera a medio escribir de una visita anterior a esta
  // misma pestaña (por ejemplo, al volver de "Cómo se verá"): si no, cada
  // vez que la página se vuelve a montar se pierde todo lo no guardado, y lo
  // único que queda es lo último guardado de verdad.
  //
  // Solo al montar, y no en cada cambio de `form`: un guardado con éxito
  // trae un `form` nuevo por `router.refresh()`, y ahí no hay nada que
  // recuperar —lo que se acaba de guardar ya es lo que hay en pantalla—.
  useEffect(() => {
    // Sin esto, el modo estricto de "next dev" (que monta y vuelve a montar
    // en desarrollo para cazar fallos) ejecuta este efecto dos veces: la
    // segunda vuelve a leer sessionStorage justo cuando el otro efecto —el
    // que escribe— ya lo había pisado con el estado de antes de restaurar, y
    // el borrador que se acababa de traer se perdía por el camino.
    if (restaurado.current) return;
    restaurado.current = true;

    const bruto = leerVistaBruta(form.type);
    if (!bruto) return;

    try {
      const borrador = JSON.parse(bruto) as {
        title: string;
        summary: string;
        fields: Field[];
      };

      // Deliberado: es la única forma de traer de vuelta un borrador que
      // vive en sessionStorage —fuera del árbol de React— justo cuando la
      // página se vuelve a montar. La regla espera derivar estado del
      // renderizado; esto sincroniza con un almacén externo, que es
      // justo el caso que la propia regla da por válido.
      /* eslint-disable react-hooks/set-state-in-effect */
      setTitulo(borrador.title);
      setResumen(borrador.summary);
      setLineas(
        borrador.fields.map((campo) => ({
          clave: crypto.randomUUID(),
          // Nueva es la que no estaba ya guardada con esa clave: es lo mismo
          // que decidiría si se acabara de añadir ahora mismo.
          nuevo: !form.fields.some((guardado) => guardado.name === campo.name),
          campo,
        })),
      );
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      // Borrador corrupto: se queda lo que ya trajo el servidor.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          ? claveDeCampo(label, [
              ...previas
                .filter((otra) => otra.clave !== clave)
                .map((otra) => otra.campo.name),
              ...clavesHistoricas,
            ])
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
    const campo = nuevoCampo([
      ...lineas.map((linea) => linea.campo.name),
      ...clavesHistoricas,
    ]);
    setLineas([...lineas, { clave, nuevo: true, campo }]);
    setAviso(null);
  }

  function quitar(clave: string) {
    setLineas(lineas.filter((linea) => linea.clave !== clave));
    setAviso(null);
  }

  function duplicar(indice: number) {
    const original = lineas[indice];
    const ocupadas = [...lineas.map((linea) => linea.campo.name), ...clavesHistoricas];
    const nombre = claveDeCampo(original.campo.label || "pregunta", ocupadas);
    const copia = { ...structuredClone(original.campo), name: nombre } as Field;

    const clave = crypto.randomUUID();
    const nuevas = [...lineas];
    nuevas.splice(indice + 1, 0, { clave, nuevo: true, campo: copia });
    setLineas(nuevas);
    setAviso(null);
  }

  function guardar() {
    setAviso(null);
    empezar(async () => {
      const resultado = await guardarFormulario(
        form.type,
        { title: titulo, summary: resumen, fields: campos },
        huellaFormulario(form),
      );

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
          Preguntas ({lineas.filter((linea) => esPregunta(linea.campo)).length})
        </h2>
        <Boton type="button" onClick={añadir}>
          <Plus size={15} aria-hidden />
          Añadir ítem
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
          // Una pregunta que ya era "checkbox" antes de retirar el tipo
          // necesita seguir viendo su propio valor en el desplegable, o
          // quedaría mostrando cualquier otra cosa sin que nadie la tocara.
          const opcionesDeTipo =
            campo.kind === "checkbox" && !TIPOS.some((tipo) => tipo.valor === "checkbox")
              ? [...TIPOS, { valor: "checkbox" as const, texto: "Casilla (retirado)" }]
              : TIPOS;

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
                    variante="ghost"
                    aria-label="Duplicar la pregunta"
                    onClick={() => duplicar(indice)}
                  >
                    <Copy size={15} aria-hidden />
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
                  {campo.kind === "seccion"
                    ? "Título de la sección"
                    : campo.kind === "texto" || campo.kind === "aviso"
                      ? "Título (opcional)"
                      : "Enunciado"}
                </label>
                <input
                  id={`${idBase}-label`}
                  className="input"
                  value={campo.label}
                  placeholder={
                    campo.kind === "texto" || campo.kind === "aviso"
                      ? "Opcional"
                      : "¿Qué se le pregunta?"
                  }
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
                    {opcionesDeTipo.map((tipo) => (
                      <option key={tipo.valor} value={tipo.valor}>
                        {tipo.texto}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field__label" htmlFor={`${idBase}-ayuda`}>
                    {campo.kind === "seccion"
                      ? "Texto bajo el título"
                      : campo.kind === "texto" || campo.kind === "aviso"
                        ? "Texto"
                        : "Aclaración"}
                  </label>
                  {campo.kind === "texto" || campo.kind === "aviso" ? (
                    <textarea
                      id={`${idBase}-ayuda`}
                      className="input"
                      rows={3}
                      value={campo.help ?? ""}
                      onChange={(evento) =>
                        cambiarComun(linea.clave, {
                          help: evento.target.value || undefined,
                        })
                      }
                    />
                  ) : (
                    <input
                      id={`${idBase}-ayuda`}
                      className="input"
                      value={campo.help ?? ""}
                      placeholder="Opcional: se lee bajo el enunciado"
                      onChange={(evento) =>
                        cambiarComun(linea.clave, {
                          help: evento.target.value || undefined,
                        })
                      }
                    />
                  )}
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
                <>
                  <label className="flex items-center gap-[var(--space-xs)] text-sm text-[var(--color-muted)]">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--color-ink)]"
                      checked={campo.multiple ?? false}
                      onChange={(evento) =>
                        cambiar(linea.clave, (actual) =>
                          actual.kind === "select"
                            ? { ...actual, multiple: evento.target.checked }
                            : actual,
                        )
                      }
                    />
                    Permitir varias respuestas
                  </label>
                  {campo.multiple ? null : (
                    <label className="flex items-center gap-[var(--space-xs)] text-sm text-[var(--color-muted)]">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--color-ink)]"
                        checked={campo.radios ?? false}
                        onChange={(evento) =>
                          cambiar(linea.clave, (actual) =>
                            actual.kind === "select"
                              ? { ...actual, radios: evento.target.checked }
                              : actual,
                          )
                        }
                      />
                      Casillas en vez de desplegable
                    </label>
                  )}
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
                </>
              ) : null}

              {campo.kind === "seccion" || campo.kind === "texto" || campo.kind === "aviso" ? null : (
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
              )}
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

        {sinGuardar ? <span className="meta">Sin guardar</span> : null}

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
          Ya hay {recibidas} solicitud(es) enviadas. Al guardar, sus respuestas
          se leerán con el cuestionario de ahora, no con el de cuando
          contestaron: una pregunta quitada o renombrada se verá como
          «pregunta retirada» en las suyas.
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
