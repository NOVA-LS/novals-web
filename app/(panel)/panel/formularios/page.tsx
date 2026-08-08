import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { traerFormularios } from "@/lib/forms/registro";
import { cambiarEstadoFormulario } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Boton, EnlaceBoton } from "@/components/ui/button";
import { CabeceraPanel } from "@/components/panel/cabecera-panel";
import { NuevoFormulario } from "@/components/panel/acciones-formulario";

export const metadata: Metadata = { title: "Formularios" };
export const dynamic = "force-dynamic";

export default async function PanelFormulariosPage() {
  await requireUser("ADMIN");

  const [formularios, configs, conteos] = await Promise.all([
    traerFormularios(),
    db.formConfig.findMany({ select: { type: true, open: true } }),
    db.submission.groupBy({ by: ["type"], _count: { _all: true } }),
  ]);

  const abiertos = new Map(configs.map((config) => [config.type, config.open]));
  const recibidas = new Map(conteos.map((fila) => [fila.type, fila._count._all]));

  return (
    <div className="shell grid max-w-[70rem] gap-[var(--space-lg)] py-[var(--space-xl)]">
      <CabeceraPanel
        titulo="Formularios"
        descripcion="Qué se admite y qué se pregunta. El cuestionario se edita entrando en cada uno."
      />

      <div className="section-head section-head--fila">
        <h2 className="display text-(length:--text-lg)">
          {formularios.length} formulario(s)
        </h2>
        <NuevoFormulario />
      </div>

      <ul className="grid gap-[var(--space-md)]">
        {formularios.map((form) => {
          const abierto = abiertos.get(form.type) !== false;

          return (
            <li key={form.type} className="tile grid gap-[var(--space-md)]">
              <div className="flex flex-wrap items-start justify-between gap-[var(--space-md)]">
                <div className="grid gap-[var(--space-2xs)]">
                  <div className="flex flex-wrap items-center gap-[var(--space-sm)]">
                    <h3 className="display text-(length:--text-lg)">
                      <Link
                        href={`/panel/formularios/${form.type}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {form.title}
                      </Link>
                    </h3>
                    <Badge tono={abierto ? "accepted" : "rejected"}>
                      {abierto ? "Abierta" : "Cerrada"}
                    </Badge>
                  </div>

                  <p className="max-w-[70ch] text-sm text-[var(--color-muted)]">
                    {form.summary}
                  </p>

                  <span className="meta">
                    Versión {form.version} · {form.fields.length} preguntas ·{" "}
                    {recibidas.get(form.type) ?? 0} recibidas
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
                  <EnlaceBoton
                    href={`/panel/formularios/${form.type}`}
                    variante="primary"
                  >
                    Editar
                  </EnlaceBoton>
                  <EnlaceBoton href={`/panel/solicitudes?tipo=${form.type}`}>
                    Sus solicitudes
                  </EnlaceBoton>

                  {/* Abrir y cerrar es lo que más se toca: desde aquí, sin
                      entrar en el cuestionario. */}
                  <form
                    action={async () => {
                      "use server";
                      await cambiarEstadoFormulario(form.type, !abierto);
                    }}
                  >
                    <Boton type="submit" variante={abierto ? "outline" : "primary"}>
                      {abierto ? "Cerrar" : "Abrir"}
                    </Boton>
                  </form>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
