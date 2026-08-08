import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { FORMS } from "@/lib/forms";
import { traerForm } from "@/lib/forms/registro";
import { cambiarCooldown, cambiarEstadoFormulario } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Boton, EnlaceBoton } from "@/components/ui/button";
import { EditorFormulario } from "@/components/panel/editor-formulario";
import {
  BotonBorrar,
  BotonRestaurar,
} from "@/components/panel/acciones-formulario";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tipo: string }>;
}): Promise<Metadata> {
  const { tipo } = await params;
  const form = await traerForm(tipo);
  return { title: form ? `${form.title} · formulario` : "Formulario" };
}

export default async function EditarFormularioPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  await requireUser("ADMIN");
  const { tipo } = await params;

  const form = await traerForm(tipo);
  if (!form) notFound();

  const [config, recibidas] = await Promise.all([
    db.formConfig.findUnique({
      where: { type: tipo },
      select: { open: true, cooldownDays: true, fields: true },
    }),
    db.submission.count({ where: { type: tipo } }),
  ]);

  const abierto = config?.open !== false;
  const cooldown = config?.cooldownDays ?? 7;
  const deFabrica = Boolean(FORMS[tipo]);
  // Solo tiene sentido volver al original si alguien lo cambió alguna vez.
  const editado = config?.fields != null;

  return (
    <div className="shell grid max-w-[76rem] gap-[var(--space-lg)] py-[var(--space-xl)]">
      <Link
        href="/panel/formularios"
        className="meta w-fit hover:text-[var(--color-ink)]"
      >
        ← Formularios
      </Link>

      <header className="grid gap-[var(--space-sm)]">
        <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
          <h1 className="display text-(length:--text-xl)">{form.title}</h1>
          <Badge tono={abierto ? "accepted" : "rejected"}>
            {abierto ? "Abierta" : "Cerrada"}
          </Badge>
        </div>

        <dl className="fichas">
          <div>
            <dt className="meta">Clave</dt>
            <dd>{form.type}</dd>
          </div>
          <div>
            <dt className="meta">Versión</dt>
            <dd>{form.version}</dd>
          </div>
          <div>
            <dt className="meta">Preguntas</dt>
            <dd>{form.fields.length}</dd>
          </div>
          <div>
            <dt className="meta">Recibidas</dt>
            <dd>{recibidas}</dd>
          </div>
        </dl>
      </header>

      {/* Lo que decide si se admite: se ve antes que las preguntas porque es lo
          que la gente nota desde fuera. */}
      <section className="tile flex flex-wrap items-end justify-between gap-[var(--space-md)]">
        <form
          action={async (datos: FormData) => {
            "use server";
            await cambiarCooldown(tipo, Number(datos.get("dias") ?? 7));
          }}
          className="grid gap-[var(--space-2xs)]"
        >
          <label className="meta" htmlFor="cooldown">
            Espera tras un rechazo (días)
          </label>
          <div className="flex items-center gap-[var(--space-xs)]">
            <input
              id="cooldown"
              name="dias"
              type="number"
              min={0}
              max={365}
              defaultValue={cooldown}
              className="input input--corto"
            />
            <Boton type="submit">Guardar espera</Boton>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
          {/* Lleva a una copia del formulario, con lo que haya en el editor
              aunque no esté guardado. La de verdad no vale para esto: si está
              cerrada, o hay una solicitud en revisión, no enseña las preguntas. */}
          <EnlaceBoton href={`/panel/formularios/${tipo}/vista`}>
            Cómo se verá
          </EnlaceBoton>

          <form
            action={async () => {
              "use server";
              await cambiarEstadoFormulario(tipo, !abierto);
            }}
          >
            <Boton type="submit" variante={abierto ? "outline" : "primary"}>
              {abierto ? "Cerrar postulaciones" : "Abrir postulaciones"}
            </Boton>
          </form>
        </div>
      </section>

      <EditorFormulario form={form} recibidas={recibidas} />

      {deFabrica || recibidas === 0 ? (
        <section className="tile grid gap-[var(--space-sm)]">
          <h2 className="display text-(length:--text-md)">Deshacer</h2>

          {deFabrica ? (
            <>
              <p className="max-w-[70ch] text-sm text-[var(--color-muted)]">
                Este formulario viene con la web y no se puede borrar, pero sí
                volver al cuestionario original. Se pierde lo editado; las
                solicitudes ya recibidas se quedan como están.
              </p>
              {editado ? (
                <BotonRestaurar tipo={tipo} />
              ) : (
                <span className="meta">Nadie lo ha tocado: ya es el original.</span>
              )}
            </>
          ) : (
            <>
              <p className="max-w-[70ch] text-sm text-[var(--color-muted)]">
                Todavía no ha recibido ninguna solicitud, así que se puede borrar
                entero. Después de la primera ya no: habría respuestas sin
                preguntas a las que pertenecer.
              </p>
              <BotonBorrar tipo={tipo} />
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
