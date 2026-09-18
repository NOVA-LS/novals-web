import Link from "next/link";
import { entrarConDiscord } from "@/lib/actions/auth";
import { Boton } from "@/components/ui/button";
import { IconoDiscord } from "@/components/icono-discord";

/**
 * Sin casilla: pulsar "Continuar con Discord" ya es aceptar que el staff
 * escriba por privado (whitelist, tickets, avisos). El texto de debajo lo
 * deja claro antes de que se pulse.
 */
export function FormularioEntrada({ destino }: { destino: string }) {
  return (
    <form action={entrarConDiscord} className="grid w-full gap-[var(--space-sm)]">
      <input type="hidden" name="destino" value={destino} />

      <Boton variante="primary" type="submit" className="btn--pill w-full">
        <IconoDiscord size={16} />
        Continuar con Discord
      </Boton>

      <p className="text-sm text-[var(--color-neutral)]">
        Al continuar, aceptas que el staff te escriba por Discord (whitelist,
        tickets y avisos), según la{" "}
        <Link href="/privacidad" className="underline hover:text-[var(--color-ink)]">
          política de privacidad
        </Link>
        .
      </p>
    </form>
  );
}
