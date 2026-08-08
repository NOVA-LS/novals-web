import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { entrarConDiscord } from "@/lib/actions/auth";
import { currentUser } from "@/lib/guards";
import { Boton } from "@/components/ui/button";

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
    <div className="shell grid max-w-[40rem] gap-[var(--space-lg)] py-[var(--space-3xl)]">
      <h1 className="display text-(length:--text-display-s)">Entrar</h1>
      <p className="text-[var(--color-muted)]">
        Usamos tu cuenta de Discord: es donde el staff te va a responder.
      </p>

      {error ? (
        <p className="field__error" role="alert">
          No se pudo completar el inicio de sesión. Inténtalo otra vez.
        </p>
      ) : null}

      <form action={entrarConDiscord}>
        <input type="hidden" name="destino" value={callbackUrl ?? "/formularios"} />
        <Boton variante="primary" type="submit">
          Continuar con Discord
        </Boton>
      </form>
    </div>
  );
}
