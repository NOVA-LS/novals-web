import Image from "next/image";
import Link from "next/link";
import { LogIn, Wrench } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser, isStaff } from "@/lib/guards";
import { entrarConDiscord } from "@/lib/actions/auth";
import { Campana } from "@/components/campana";
import { MenuUsuario } from "@/components/menu-usuario";
import { Boton } from "@/components/ui/button";
import { avisosParaCampana } from "@/lib/avisos-vista";

export async function SiteHeader() {
  const user = await currentUser();
  const staff = Boolean(user && isStaff(user.role));

  // El contador solo se consulta para quien puede hacer algo con él.
  const pendientes = staff
    ? await db.submission.count({
        where: { status: { in: ["PENDING", "IN_REVIEW"] } },
      })
    : 0;

  const campana = user ? await avisosParaCampana(user.id) : null;

  return (
    <header className="sticky top-0 z-[500] border-b border-[var(--color-rule)] bg-[color-mix(in_oklch,var(--color-paper)_82%,transparent)] backdrop-blur-md">
      <div className="shell flex h-16 items-center justify-between gap-[var(--space-sm)]">
        <Link href="/" aria-label="NOVA Los Santos · inicio" className="shrink-0">
          <Image
            src="/brand/logo_blanco_tight.webp"
            alt="NOVA Los Santos"
            width={1966}
            height={787}
            priority
            sizes="104px"
            className="h-8 w-auto sm:h-9"
          />
        </Link>

        <div className="flex shrink-0 items-center gap-[var(--space-sm)]">
          {/* El salto al panel, junto a la campana y no junto a la marca: el
              staff lo usa muchas veces al día, pero es un atajo de trabajo, no
              parte de la identidad. Solo el icono: con texto no cabía junto al
              resto de la cabecera. */}
          {staff ? (
            <Link
              href="/panel"
              className="menu__boton menu__boton--icono"
              aria-label={
                pendientes > 0
                  ? `Ir a la zona de staff · ${pendientes} pendientes`
                  : "Ir a la zona de staff"
              }
            >
              <span className="icono-atajo">
                <Wrench size={18} aria-hidden />
                {pendientes > 0 ? <span className="contador">{pendientes}</span> : null}
              </span>
            </Link>
          ) : null}

          {user && campana ? (
            <Campana avisos={campana.avisos} sinLeer={campana.sinLeer} />
          ) : null}

          {user ? (
            <MenuUsuario nombre={user.username} avatar={user.avatar} />
          ) : (
            <form action={entrarConDiscord}>
              <input type="hidden" name="destino" value="/formularios" />
              <Boton variante="primary" type="submit">
                <LogIn size={15} aria-hidden />
                Entrar
              </Boton>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
