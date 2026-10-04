"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { guardarNoticia, previsualizarMarkdown } from "@/lib/actions/posts";
import type { GrupoDeCanales } from "@/lib/discord/canales";
import type { RolDiscord } from "@/lib/discord/menciones";
import { MAX_IMAGEN_MB } from "@/lib/limites";
import { Boton } from "@/components/ui/button";
import { CampoArchivo } from "@/components/ui/campo-archivo";
import { Desplegable } from "@/components/ui/desplegable";

type Noticia = {
  id: string;
  title: string;
  excerpt: string;
  contentMd: string;
  published: boolean;
  coverImage: string | null;
  channelId: string | null;
  roleId: string | null;
  notificarPrivado: boolean;
};

/** En qué categoría cae un canal ya elegido, para preseleccionar el primer desplegable. */
function categoriaDelCanal(grupos: GrupoDeCanales[], channelId: string | null) {
  if (!channelId) return undefined;
  return grupos.find((grupo) => grupo.canales.some((canal) => canal.id === channelId))?.categoria
    .id;
}

export function EditorNoticia({
  noticia,
  canales,
  roles,
}: {
  noticia?: Noticia;
  canales: GrupoDeCanales[];
  roles: RolDiscord[];
}) {
  const [contenido, setContenido] = useState(noticia?.contentMd ?? "");
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, empezar] = useTransition();
  const [categoriaId, setCategoriaId] = useState(
    () => categoriaDelCanal(canales, noticia?.channelId ?? null) ?? "",
  );
  const [channelId, setChannelId] = useState(noticia?.channelId ?? "");
  const [roleId, setRoleId] = useState(noticia?.roleId ?? "");

  const canalesDeLaCategoria = useMemo(
    () => canales.find((grupo) => grupo.categoria.id === categoriaId)?.canales ?? [],
    [canales, categoriaId],
  );

  // Saneado en el servidor, con el mismo renderMarkdown que se usa al
  // publicar: nunca se inyecta el HTML crudo de marked en el navegador.
  useEffect(() => {
    if (!vistaPrevia || !contenido) return;

    let vigente = true;
    const espera = setTimeout(() => {
      previsualizarMarkdown(contenido).then((sano) => {
        if (vigente) setHtml(sano);
      });
    }, 300);

    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [contenido, vistaPrevia]);

  function onSubmit(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);

    empezar(async () => {
      const resultado = await guardarNoticia(noticia?.id ?? null, datos);
      // Si todo va bien la acción redirige, así que llegar aquí es un fallo.
      if (resultado && !resultado.ok) setError(resultado.mensaje ?? "No se pudo guardar.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-[var(--space-lg)]">
      <div className="field">
        <label className="field__label" htmlFor="title">
          Título
        </label>
        <input
          id="title"
          name="title"
          className="input"
          defaultValue={noticia?.title}
          maxLength={120}
          disabled={guardando}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="excerpt">
          Entradilla
        </label>
        <p className="field__help">Una o dos frases. Es lo que se ve en la portada.</p>
        <textarea
          id="excerpt"
          name="excerpt"
          className="input"
          rows={2}
          maxLength={300}
          defaultValue={noticia?.excerpt}
          disabled={guardando}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="coverImage">
          Portada
        </label>
        <p className="field__help">
          JPG, PNG o WEBP, hasta {MAX_IMAGEN_MB} MB.
          {noticia?.coverImage ? " Si no subes otra, se mantiene la actual." : ""}
        </p>
        <CampoArchivo
          id="coverImage"
          name="coverImage"
          accept="image/jpeg,image/png,image/webp"
          disabled={guardando}
        />
      </div>

      <div className="field">
        <div className="flex items-center justify-between gap-[var(--space-sm)]">
          <label className="field__label" htmlFor="contentMd">
            Contenido (Markdown)
          </label>
          <Boton
            type="button"
            variante="ghost"
            onClick={() => setVistaPrevia((valor) => !valor)}
          >
            {vistaPrevia ? "Editar" : "Vista previa"}
          </Boton>
        </div>

        {vistaPrevia ? (
          <div
            className="tile prose"
            dangerouslySetInnerHTML={{
              __html: contenido ? html : "<p>Nada que previsualizar todavía.</p>",
            }}
          />
        ) : (
          <textarea
            id="contentMd"
            name="contentMd"
            className="input font-mono text-sm"
            rows={18}
            value={contenido}
            onChange={(evento) => setContenido(evento.target.value)}
            disabled={guardando}
          />
        )}
        {vistaPrevia ? (
          <input type="hidden" name="contentMd" value={contenido} />
        ) : null}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="categoriaDiscord">
          Canal de Discord (opcional)
        </label>
        <p className="field__help">
          {canales.length > 0
            ? "Al publicarse, se avisa en el canal elegido. Sin canal, no se avisa en ninguno."
            : "No se pudo traer la lista de canales de Discord. Puedes publicar igualmente, sin avisar en ningún canal."}
        </p>
        <div className="grid grid-cols-1 gap-[var(--space-sm)] sm:grid-cols-2">
          <Desplegable
            id="categoriaDiscord"
            valor={categoriaId}
            disabled={guardando || canales.length === 0}
            placeholder="Elige una categoría…"
            alCambiar={(nuevo) => {
              setCategoriaId(nuevo);
              setChannelId("");
            }}
            opciones={canales.map((grupo) => ({
              valor: grupo.categoria.id,
              etiqueta: grupo.categoria.name,
            }))}
          />

          <Desplegable
            id="channelId"
            name="channelId"
            valor={channelId}
            disabled={guardando || canalesDeLaCategoria.length === 0}
            placeholder="Elige un canal…"
            alCambiar={setChannelId}
            opciones={canalesDeLaCategoria.map((canal) => ({
              valor: canal.id,
              etiqueta: `#${canal.name}`,
            }))}
          />
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="roleId">
          Rol a mencionar (opcional)
        </label>
        <p className="field__help">
          {roles.length > 0
            ? "Debajo del anuncio del canal se menciona a este rol, tapado con un spoiler. Hace falta elegir un canal; sin canal no se menciona a nadie. El rol tiene que ser mencionable, o el bot tener permiso para mencionar a todos."
            : "No se pudo traer la lista de roles de Discord."}
        </p>
        <Desplegable
          id="roleId"
          name="roleId"
          valor={roleId}
          disabled={guardando || roles.length === 0 || !channelId}
          placeholder="Sin mención"
          alCambiar={setRoleId}
          opciones={[
            { valor: "", etiqueta: "Sin mención" },
            ...roles.map((rol) => ({ valor: rol.id, etiqueta: `@${rol.name}` })),
          ]}
        />
      </div>

      <div className="field">
        <label className="flex items-center gap-[var(--space-xs)] text-sm text-[var(--color-muted)]">
          <input
            type="checkbox"
            name="notificarPrivado"
            defaultChecked={noticia?.notificarPrivado ?? true}
            disabled={guardando}
            className="size-4 accent-[var(--color-ink)]"
          />
          Notificar por privado a los usuarios
        </label>
        <p className="field__help">
          Al publicarse, se manda un mensaje privado a quien tenga activados los avisos de
          noticias. Solo se envía la primera vez que se publica.
        </p>
      </div>

      <label className="flex items-center gap-[var(--space-xs)] text-sm text-[var(--color-muted)]">
        <input
          type="checkbox"
          name="published"
          defaultChecked={noticia?.published}
          disabled={guardando}
          className="size-4 accent-[var(--color-ink)]"
        />
        Publicada
      </label>

      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <Boton
          type="submit"
          variante="primary"
          disabled={guardando}
          data-state={guardando ? "loading" : undefined}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </Boton>
      </div>
    </form>
  );
}
