"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enviarSolicitud } from "@/lib/actions/submissions";
import { answersFromFormData, paginasDe, schemaFor, type FormDefinition } from "@/lib/forms";
import { Layers } from "lucide-react";
import { Boton } from "@/components/ui/button";
import { CampoFormulario } from "@/components/ui/campo";

type Errores = Record<string, string>;

export function FormRenderer({ form }: { form: FormDefinition }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();
  const clave = `nova:borrador:${form.type}`;

  // Cada "sección" abre una página: quien rellena va de una a otra en vez de
  // ver todo el formulario de golpe.
  const paginas = useMemo(() => paginasDe(form.fields), [form.fields]);
  const [paginaActual, setPaginaActual] = useState(0);
  const ultimaPagina = paginaActual === paginas.length - 1;
  const paginaDeCampo = useMemo(() => {
    const mapa = new Map<string, number>();
    paginas.forEach((pagina, indice) => {
      for (const campo of pagina) mapa.set(campo.name, indice);
    });
    return mapa;
  }, [paginas]);

  // Borrador local: si el navegador se cierra a medias, no se pierde el texto.
  useEffect(() => {
    const guardado = localStorage.getItem(clave);
    if (!guardado) return;

    try {
      const valores = JSON.parse(guardado) as Record<string, unknown>;
      for (const [nombre, valor] of Object.entries(valores)) {
        if (Array.isArray(valor)) {
          const casillas = document.querySelectorAll<HTMLInputElement>(
            `[name="${CSS.escape(nombre)}"]`,
          );
          casillas.forEach((casilla) => {
            casilla.checked = valor.includes(casilla.value);
          });
          continue;
        }

        const campo = document.querySelector<HTMLInputElement>(
          `[name="${CSS.escape(nombre)}"]`,
        );
        if (!campo) continue;
        if (campo.type === "checkbox") campo.checked = Boolean(valor);
        else campo.value = String(valor ?? "");
      }
    } catch {
      localStorage.removeItem(clave);
    }
  }, [clave]);

  function guardarBorrador(formulario: HTMLFormElement) {
    const datos = new FormData(formulario);
    const valores: Record<string, unknown> = {};
    for (const campo of form.fields) {
      if (campo.kind === "seccion" || campo.kind === "texto" || campo.kind === "aviso") continue;
      // Un archivo no se puede guardar en localStorage: hay que volver a
      // elegirlo si se recarga la página.
      if (campo.kind === "file") continue;

      if (campo.kind === "select" && campo.multiple) {
        valores[campo.name] = datos.getAll(campo.name);
        continue;
      }

      valores[campo.name] =
        campo.kind === "checkbox"
          ? datos.get(campo.name) !== null
          : (datos.get(campo.name) ?? "");
    }
    localStorage.setItem(clave, JSON.stringify(valores));
  }

  /**
   * Valida solo las preguntas de la página actual y, si pasan, avanza.
   *
   * No es un submit: los campos de las demás páginas siguen ahí, solo
   * ocultos, así que `answersFromFormData`/`schemaFor` se restringen a los
   * de esta página para no bloquear por algo que todavía no le toca rellenar.
   */
  function avanzar() {
    const formulario = formRef.current;
    if (!formulario) return;

    setAviso(null);
    const datos = new FormData(formulario);
    const definicionPagina = { ...form, fields: paginas[paginaActual] };
    const bruto = answersFromFormData(definicionPagina, datos, {
      archivoElegido: (campo) => {
        const elegido = datos.get(campo.name);
        return elegido instanceof File && elegido.size > 0 ? "elegido" : "";
      },
    });

    const parsed = schemaFor(definicionPagina).safeParse(bruto);
    if (!parsed.success) {
      const nuevos: Errores = {};
      for (const issue of parsed.error.issues) {
        const nombre = String(issue.path[0] ?? "");
        if (nombre && !nuevos[nombre]) nuevos[nombre] = issue.message;
      }
      setErrores((previos) => ({ ...previos, ...nuevos }));
      const primero = Object.keys(nuevos)[0];
      document.querySelector<HTMLElement>(`[name="${CSS.escape(primero)}"]`)?.focus();
      return;
    }

    setErrores((previos) => {
      const limpio = { ...previos };
      for (const campo of paginas[paginaActual]) delete limpio[campo.name];
      return limpio;
    });
    setPaginaActual((pagina) => pagina + 1);
    formulario.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function retroceder() {
    setAviso(null);
    setPaginaActual((pagina) => Math.max(0, pagina - 1));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onSubmit(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setAviso(null);

    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);

    // Misma validación que en el servidor: sale del mismo esquema. La URL real
    // de un archivo la resuelve el servidor al subirlo; aquí solo hace falta
    // saber si hay uno elegido, para el aviso de obligatorio.
    const bruto = answersFromFormData(form, datos, {
      archivoElegido: (campo) => {
        const elegido = datos.get(campo.name);
        return elegido instanceof File && elegido.size > 0 ? "elegido" : "";
      },
    });

    const parsed = schemaFor(form).safeParse(bruto);
    if (!parsed.success) {
      const nuevos: Errores = {};
      for (const issue of parsed.error.issues) {
        const nombre = String(issue.path[0] ?? "");
        if (nombre && !nuevos[nombre]) nuevos[nombre] = issue.message;
      }
      setErrores(nuevos);
      const primero = Object.keys(nuevos)[0];
      document
        .querySelector<HTMLElement>(`[name="${CSS.escape(primero)}"]`)
        ?.focus();
      return;
    }

    setErrores({});
    empezar(async () => {
      const resultado = await enviarSolicitud(form.type, datos);
      if (resultado.ok) {
        localStorage.removeItem(clave);
        router.push("/perfil");
        router.refresh();
      } else {
        setAviso(resultado.mensaje);
        if (resultado.errores) setErrores(resultado.errores);
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onChange={(evento) => guardarBorrador(evento.currentTarget)}
      className="grid gap-[var(--space-lg)]"
      noValidate
    >
      {form.fields.map((campo) => (
        // Se quedan todos montados, aunque no toquen a esta página: si se
        // desmontaran, lo escrito en una página anterior se perdería al
        // volver a ella, y el envío final —que lee el FormData del
        // formulario entero— dejaría de traerlo.
        <div key={campo.name} hidden={paginaDeCampo.get(campo.name) !== paginaActual}>
          <CampoFormulario campo={campo} error={errores[campo.name]} deshabilitado={enviando} />
        </div>
      ))}

      {aviso ? (
        <p className="field__error" role="alert">
          {aviso}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-[var(--space-md)]">
        <div className="flex items-center gap-[var(--space-md)]">
          {paginaActual > 0 ? (
            <Boton
              type="button"
              className="btn--redondo"
              onClick={retroceder}
              disabled={enviando}
            >
              Anterior
            </Boton>
          ) : null}

          {ultimaPagina ? (
            <>
              <Boton
                type="submit"
                variante="primary"
                className="btn--redondo"
                disabled={enviando}
                data-state={enviando ? "loading" : undefined}
              >
                {enviando ? "Enviando…" : "Enviar solicitud"}
              </Boton>
              <span className="meta">Se guarda un borrador en este navegador</span>
            </>
          ) : (
            <Boton
              type="button"
              variante="primary"
              className="btn--redondo"
              onClick={avanzar}
              disabled={enviando}
            >
              Siguiente
            </Boton>
          )}
        </div>

        {paginas.length > 1 ? (
          <span className="meta flex items-center gap-[var(--space-2xs)]">
            <Layers size={13} aria-hidden />
            Página {paginaActual + 1} de {paginas.length}
          </span>
        ) : null}
      </div>
    </form>
  );
}
