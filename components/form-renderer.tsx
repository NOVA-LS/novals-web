"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enviarSolicitud } from "@/lib/actions/submissions";
import { schemaFor, type FormDefinition } from "@/lib/forms";
import { Boton } from "@/components/ui/button";
import { CampoFormulario } from "@/components/ui/campo";

type Errores = Record<string, string>;

export function FormRenderer({ form }: { form: FormDefinition }) {
  const router = useRouter();
  const [errores, setErrores] = useState<Errores>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();
  const clave = `nova:borrador:${form.type}`;

  // Borrador local: si el navegador se cierra a medias, no se pierde el texto.
  useEffect(() => {
    const guardado = localStorage.getItem(clave);
    if (!guardado) return;

    try {
      const valores = JSON.parse(guardado) as Record<string, unknown>;
      for (const [nombre, valor] of Object.entries(valores)) {
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
      valores[campo.name] =
        campo.kind === "checkbox"
          ? datos.get(campo.name) !== null
          : (datos.get(campo.name) ?? "");
    }
    localStorage.setItem(clave, JSON.stringify(valores));
  }

  function onSubmit(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setAviso(null);

    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);

    // Misma validación que en el servidor: sale del mismo esquema.
    const bruto: Record<string, unknown> = {};
    for (const campo of form.fields) {
      bruto[campo.name] =
        campo.kind === "checkbox"
          ? datos.get(campo.name) !== null
          : (datos.get(campo.name) ?? "");
    }

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
      onSubmit={onSubmit}
      onChange={(evento) => guardarBorrador(evento.currentTarget)}
      className="grid gap-[var(--space-lg)]"
      noValidate
    >
      {form.fields.map((campo) => (
        <CampoFormulario
          key={campo.name}
          campo={campo}
          error={errores[campo.name]}
          deshabilitado={enviando}
        />
      ))}

      {aviso ? (
        <p className="field__error" role="alert">
          {aviso}
        </p>
      ) : null}

      <div className="flex items-center gap-[var(--space-md)]">
        <Boton
          type="submit"
          variante="primary"
          disabled={enviando}
          data-state={enviando ? "loading" : undefined}
        >
          {enviando ? "Enviando…" : "Enviar solicitud"}
        </Boton>
        <span className="meta">Se guarda un borrador en este navegador</span>
      </div>
    </form>
  );
}
