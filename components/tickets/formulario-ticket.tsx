"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { abrirTicket } from "@/lib/actions/tickets";
import { schemaFor } from "@/lib/forms";
import type { CategoriaTicket } from "@/lib/tickets/categorias";
import { MAX_ADJUNTOS } from "@/lib/limites";
import { Boton } from "@/components/ui/button";
import { CampoFormulario } from "@/components/ui/campo";

/**
 * Abrir un ticket de una categoría.
 *
 * Valida con el mismo esquema que el servidor —sale de las mismas preguntas—,
 * así que lo que se marca en rojo aquí es exactamente lo que rechazaría allí.
 */
export function FormularioTicket({ categoria }: { categoria: CategoriaTicket }) {
  const router = useRouter();
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();

  function onSubmit(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setAviso(null);

    const datos = new FormData(evento.currentTarget);

    const bruto: Record<string, unknown> = {};
    for (const campo of categoria.campos) {
      bruto[campo.name] =
        campo.kind === "checkbox"
          ? datos.get(campo.name) !== null
          : (datos.get(campo.name) ?? "");
    }

    const parsed = schemaFor({
      type: categoria.clave,
      title: categoria.nombre,
      summary: categoria.descripcion,
      fields: categoria.campos,
    }).safeParse(bruto);

    if (!parsed.success) {
      const nuevos: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const nombre = String(issue.path[0] ?? "");
        if (nombre && !nuevos[nombre]) nuevos[nombre] = issue.message;
      }
      setErrores(nuevos);
      document
        .querySelector<HTMLElement>(`[name="${CSS.escape(Object.keys(nuevos)[0])}"]`)
        ?.focus();
      return;
    }

    setErrores({});
    empezar(async () => {
      const resultado = await abrirTicket(categoria.clave, datos);
      if (resultado.ok) {
        router.push(`/tickets/${resultado.id}`);
        router.refresh();
      } else {
        setAviso(resultado.mensaje);
        if (resultado.errores) setErrores(resultado.errores);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-[var(--space-lg)]" noValidate>
      {categoria.campos.map((campo) => (
        <CampoFormulario
          key={campo.name}
          campo={campo}
          error={errores[campo.name]}
          deshabilitado={enviando}
        />
      ))}

      <div className="field">
        <label className="field__label" htmlFor="acompanantes">
          ¿Va con más gente?
          <span className="text-[var(--color-neutral)]"> · opcional</span>
        </label>
        <p className="field__help">
          Identificadores de Discord separados por comas. Tienen que haber
          entrado ya en la web. Verán el ticket entero y podrán escribir, así que
          ponlos solo si estuvieron en lo que cuentas.
        </p>
        <input
          id="acompanantes"
          name="acompanantes"
          className="input"
          inputMode="numeric"
          placeholder="123456789012345678, 987654321098765432"
          disabled={enviando}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="adjuntos">
          Capturas
          <span className="text-[var(--color-neutral)]"> · opcional</span>
        </label>
        <p className="field__help">
          Hasta {MAX_ADJUNTOS} imágenes. Se guardan sin los datos de la cámara.
        </p>
        <input
          id="adjuntos"
          name="adjuntos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={enviando}
          className="input"
        />
      </div>

      {aviso ? (
        <p className="field__error" role="alert">
          {aviso}
        </p>
      ) : null}

      <div className="flex items-center gap-[var(--space-md)]">
        <Boton type="submit" variante="primary" disabled={enviando}>
          {enviando ? "Enviando…" : "Abrir ticket"}
        </Boton>
      </div>
    </form>
  );
}
