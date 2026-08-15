"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  borrarFormulario,
  crearFormulario,
  duplicarFormulario,
  restaurarFormulario,
} from "@/lib/actions/formularios";
import { Boton } from "@/components/ui/button";

/** Crea uno de cero y lleva directo a su editor: recién hecho está vacío. */
export function NuevoFormulario() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creando, empezar] = useTransition();

  function crear(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    empezar(async () => {
      const resultado = await crearFormulario(nombre);
      if (resultado.ok && resultado.tipo) {
        setNombre("");
        router.push(`/panel/formularios/${resultado.tipo}`);
        return;
      }
      setError(resultado.mensaje ?? "No se pudo crear.");
    });
  }

  return (
    <form onSubmit={crear} className="grid gap-[var(--space-xs)]">
      <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
        <input
          className="input input--corto"
          aria-label="Nombre del formulario nuevo"
          placeholder="Nombre del nuevo"
          value={nombre}
          maxLength={60}
          onChange={(evento) => setNombre(evento.target.value)}
          disabled={creando}
        />
        <Boton type="submit" disabled={creando}>
          <Plus size={15} aria-hidden />
          {creando ? "Creando…" : "Crear"}
        </Boton>
      </div>

      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}

/**
 * Copia el formulario actual con otro nombre y lleva directo a su editor.
 *
 * Va junto al título, así que empieza cerrado: un botón suelto, no una caja
 * con un campo de texto siempre a la vista. El nombre solo hace falta pedirlo
 * cuando alguien de verdad va a duplicar.
 */
export function DuplicarFormulario({
  tipo,
  tituloOriginal,
}: {
  tipo: string;
  tituloOriginal: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(`${tituloOriginal} (copia)`);
  const [error, setError] = useState<string | null>(null);
  const [duplicando, empezar] = useTransition();

  function duplicar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    empezar(async () => {
      const resultado = await duplicarFormulario(tipo, nombre);
      if (resultado.ok && resultado.tipo) {
        router.push(`/panel/formularios/${resultado.tipo}`);
        return;
      }
      setError(resultado.mensaje ?? "No se pudo duplicar.");
    });
  }

  if (!abierto) {
    return (
      <Boton type="button" variante="ghost" onClick={() => setAbierto(true)}>
        <Copy size={15} aria-hidden />
        Duplicar
      </Boton>
    );
  }

  return (
    <form onSubmit={duplicar} className="grid justify-items-end gap-[var(--space-xs)]">
      <div className="flex flex-wrap items-center justify-end gap-[var(--space-xs)]">
        <input
          className="input input--corto"
          aria-label="Nombre del formulario duplicado"
          value={nombre}
          maxLength={60}
          autoFocus
          onChange={(evento) => setNombre(evento.target.value)}
          disabled={duplicando}
        />
        <Boton type="submit" variante="primary" disabled={duplicando}>
          {duplicando ? "Duplicando…" : "Confirmar"}
        </Boton>
        <Boton
          type="button"
          variante="ghost"
          onClick={() => setAbierto(false)}
          disabled={duplicando}
        >
          Cancelar
        </Boton>
      </div>

      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}

/** Devuelve un formulario del código a como venía de fábrica. */
export function BotonRestaurar({ tipo }: { tipo: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [yendo, empezar] = useTransition();

  return (
    <div className="grid gap-[var(--space-2xs)]">
      <Boton
        type="button"
        disabled={yendo}
        onClick={() =>
          empezar(async () => {
            const resultado = await restaurarFormulario(tipo);
            if (resultado.ok) router.refresh();
            else setError(resultado.mensaje ?? "No se pudo.");
          })
        }
      >
        <RotateCcw size={15} aria-hidden />
        {yendo ? "Volviendo…" : "Volver al original"}
      </Boton>

      {error ? <span className="field__error">{error}</span> : null}
    </div>
  );
}

/**
 * Borra el formulario. Va en dos toques a propósito: no hay papelera, y el
 * servidor solo lo permite cuando nadie ha enviado nada por él.
 */
export function BotonBorrar({ tipo }: { tipo: string }) {
  const router = useRouter();
  const [seguro, setSeguro] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrando, empezar] = useTransition();

  return (
    <div className="grid gap-[var(--space-2xs)]">
      <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
        <Boton
          type="button"
          variante="danger"
          disabled={borrando}
          onClick={() => {
            if (!seguro) {
              setSeguro(true);
              return;
            }
            empezar(async () => {
              const resultado = await borrarFormulario(tipo);
              if (resultado.ok) {
                router.push("/panel/formularios");
                router.refresh();
              } else {
                setSeguro(false);
                setError(resultado.mensaje ?? "No se pudo borrar.");
              }
            });
          }}
        >
          <Trash2 size={15} aria-hidden />
          {borrando ? "Borrando…" : seguro ? "Confirmar borrado" : "Borrar"}
        </Boton>

        {seguro && !borrando ? (
          <Boton type="button" variante="ghost" onClick={() => setSeguro(false)}>
            Dejarlo
          </Boton>
        ) : null}
      </div>

      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
