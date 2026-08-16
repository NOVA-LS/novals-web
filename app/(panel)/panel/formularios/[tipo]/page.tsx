import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { FORMS, esPregunta } from "@/lib/forms";
import { traerForm } from "@/lib/forms/registro";
import { cambiarCooldown, cambiarEstadoFormulario, cambiarVentana } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Boton, EnlaceBoton } from "@/components/ui/button";
import { EditorFormulario } from "@/components/panel/editor-formulario";
import {
  BotonBorrar,
  BotonRestaurar,
  DuplicarFormulario,
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

  const [config, recibidas, respuestas] = await Promise.all([
    db.formConfig.findUnique({
      where: { type: tipo },
      select: {
        open: true,
        cooldownDays: true,
        fields: true,
        openFrom: true,
        openUntil: true,
      },
    }),
    db.submission.count({ where: { type: tipo } }),
    db.submission.findMany({ where: { type: tipo }, select: { answers: true } }),
  ]);

  // Claves que alguna vez se han guardado en una respuesta, aunque la pregunta
  // ya no exista: una pregunta nueva no puede heredar ninguna de estas, o sus
  // respuestas viejas se leerían como si fueran suyas.
  const clavesHistoricas = [
    ...new Set(
      respuestas.flatMap((respuesta) =>
        respuesta.answers && typeof respuesta.answers === "object"
          ? Object.keys(respuesta.answers as Record<string, unknown>)
          : [],
      ),
    ),
  ];

  const abierto = config?.open !== false;
  const cooldown = config?.cooldownDays ?? 7;
  const desde = config?.openFrom ? config.openFrom.toISOString().slice(0, 16) : "";
  const hasta = config?.openUntil ? config.openUntil.toISOString().slice(0, 16) : "";
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

      <header className="flex flex-wrap items-start justify-between gap-[var(--space-md)]">
        <div className="grid gap-[var(--space-sm)]">
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
              <dt className="meta">Preguntas</dt>
              <dd>{form.fields.filter(esPregunta).length}</dd>
            </div>
            <div>
              <dt className="meta">Recibidas</dt>
              <dd>{recibidas}</dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-[var(--space-xs)] justify-items-end">
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

          <DuplicarFormulario tipo={tipo} tituloOriginal={form.title} />
        </div>
      </header>

      {/* Lo que decide si se admite: se ve antes que las preguntas porque es lo
          que la gente nota desde fuera. */}
      <section className="tile grid gap-[var(--space-lg)]">
        <div className="flex flex-wrap items-start justify-between gap-[var(--space-lg)]">
          <form
            action={async (datos: FormData) => {
              "use server";
              await cambiarCooldown(tipo, Number(datos.get("dias") ?? 7));
            }}
            className="grid shrink-0 content-start gap-[var(--space-2xs)]"
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
              <Boton type="submit">Guardar</Boton>
            </div>
          </form>

          <form
            action={async (datos: FormData) => {
              "use server";
              await cambiarVentana(tipo, {
                desde: String(datos.get("desde") ?? ""),
                hasta: String(datos.get("hasta") ?? ""),
              });
            }}
            className="grid shrink-0 content-start gap-[var(--space-2xs)]"
          >
            <span className="meta">Apertura programada (opcional)</span>
            <div className="flex flex-nowrap items-center gap-[var(--space-xs)]">
              <input
                name="desde"
                type="datetime-local"
                defaultValue={desde}
                className="input input--fecha"
                aria-label="Se abre el"
              />
              <input
                name="hasta"
                type="datetime-local"
                defaultValue={hasta}
                className="input input--fecha"
                aria-label="Se cierra el"
              />
              <Boton type="submit">Guardar</Boton>
            </div>
          </form>
        </div>
      </section>

      <EditorFormulario form={form} recibidas={recibidas} clavesHistoricas={clavesHistoricas} />

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
