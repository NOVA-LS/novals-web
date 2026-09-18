import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/guards";
import { FormularioEntrada } from "@/components/formulario-entrada";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const usuario = await currentUser();
  if (usuario) redirect("/");

  const { error, callbackUrl } = await searchParams;

  return (
    <div className="shell grid min-h-[70svh] place-items-center py-[var(--space-3xl)]">
      <div className="tarjeta-acceso grid w-full max-w-[30rem] justify-items-center gap-[var(--space-lg)] text-center">
        <div className="grid gap-[var(--space-sm)]">
          <h1 className="display text-(length:--text-display-s)">¡Bienvenido!</h1>
          <p className="text-[var(--color-muted)]">
            Usamos tu cuenta de Discord para mantenerte informado, esto nos
            ayudará a tener una mejor comunicación contigo.
          </p>
        </div>

        {error ? (
          <p className="field__error" role="alert">
            No se pudo completar el inicio de sesión. Inténtalo otra vez.
          </p>
        ) : null}

        <FormularioEntrada destino={callbackUrl ?? "/formularios"} />
      </div>
    </div>
  );
}
