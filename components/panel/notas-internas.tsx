"use client";

import { useRef, useState, useTransition } from "react";
import { StickyNote, Trash2 } from "lucide-react";
import { anadirNota, borrarNota } from "@/lib/actions/notas";
import { Avatar } from "@/components/ui/avatar";
import { Boton } from "@/components/ui/button";

export type Nota = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; username: string; avatar: string | null };
};

export function NotasInternas({
  userId,
  nombre,
  notas,
  revisorId,
  esAdmin,
}: {
  userId: string;
  nombre: string;
  notas: Nota[];
  /** Quién mira: cada cual borra lo suyo, y el admin todo. */
  revisorId: string;
  esAdmin: boolean;
}) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();

  function onSubmit(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const texto = campo.current?.value ?? "";
    setError(null);

    empezar(async () => {
      const resultado = await anadirNota(userId, texto);
      if (resultado.ok) {
        if (campo.current) campo.current.value = "";
      } else {
        setError(resultado.mensaje ?? "No se pudo guardar.");
      }
    });
  }

  return (
    <section className="tile grid gap-[var(--space-md)]">
      <div className="flex items-center gap-[var(--space-sm)]">
        <StickyNote size={18} className="text-[var(--color-muted)]" aria-hidden />
        <h2 className="display text-(length:--text-md)">Notas internas</h2>
      </div>
      <p className="text-sm text-[var(--color-muted)]">
        Solo las ve el staff. {nombre} nunca las lee, ni en su perfil ni por
        privado.
      </p>

      <form onSubmit={onSubmit} className="grid gap-[var(--space-sm)]">
        <textarea
          ref={campo}
          className="input text-sm"
          rows={3}
          maxLength={1000}
          placeholder="Contexto que le sirva al siguiente que lo revise…"
          aria-label="Nueva nota"
          disabled={ocupado}
        />
        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <Boton
            type="submit"
            disabled={ocupado}
            data-state={ocupado ? "loading" : undefined}
          >
            {ocupado ? "Guardando…" : "Añadir nota"}
          </Boton>
        </div>
      </form>

      {notas.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          Todavía no hay notas sobre esta persona.
        </p>
      ) : (
        <ul className="grid gap-[var(--space-sm)]">
          {notas.map((nota) => (
            <li
              key={nota.id}
              className="grid gap-[var(--space-2xs)] border-l-2 border-[var(--color-rule-strong)] pl-[var(--space-md)]"
            >
              <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
                <Avatar
                  src={nota.author.avatar}
                  nombre={nota.author.username}
                  size={20}
                />
                <span className="meta">{nota.author.username}</span>
                <span className="meta">{nota.createdAt}</span>

                {esAdmin || nota.author.id === revisorId ? (
                  <Boton
                    type="button"
                    variante="ghost"
                    className="ml-auto"
                    aria-label="Borrar nota"
                    disabled={ocupado}
                    onClick={() => {
                      if (!confirm("¿Borrar esta nota?")) return;
                      empezar(async () => {
                        const resultado = await borrarNota(nota.id);
                        if (!resultado.ok) {
                          setError(resultado.mensaje ?? "No se pudo borrar.");
                        }
                      });
                    }}
                  >
                    <Trash2 size={14} aria-hidden />
                  </Boton>
                ) : null}
              </div>
              <p className="respuesta text-sm">{nota.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
