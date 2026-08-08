"use client";

import { useRef, useState, useTransition } from "react";
import { responder } from "@/lib/actions/foro";
import { Boton } from "@/components/ui/button";

export function FormularioRespuesta({ threadId }: { threadId: string }) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();

  function onSubmit(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const texto = campo.current?.value ?? "";
    setError(null);

    empezar(async () => {
      const resultado = await responder(threadId, texto);
      if (resultado.ok) {
        if (campo.current) campo.current.value = "";
      } else {
        setError(resultado.mensaje ?? "No se pudo publicar.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="tile grid gap-[var(--space-sm)]">
      <label className="field__label" htmlFor="respuesta">
        Responder
      </label>
      <p className="field__help">Acepta Markdown: **negrita**, listas y enlaces.</p>
      <textarea
        ref={campo}
        id="respuesta"
        className="input text-sm"
        rows={5}
        maxLength={20000}
        disabled={enviando}
      />

      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <Boton
          type="submit"
          variante="primary"
          disabled={enviando}
          data-state={enviando ? "loading" : undefined}
        >
          {enviando ? "Publicando…" : "Publicar"}
        </Boton>
      </div>
    </form>
  );
}
