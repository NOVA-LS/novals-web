import Image from "next/image";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { db } from "@/lib/db";
import { currentUser, isStaff } from "@/lib/guards";
import { Campana } from "@/components/campana";
import { EnlaceEntrar } from "@/components/enlace-entrar";
import { MenuUsuario } from "@/components/menu-usuario";
import { NavEnlaces } from "@/components/nav-enlaces";
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
  const discord = process.env.NEXT_PUBLIC_DISCORD_INVITE;

  return (
    <header className="shell sticky top-[var(--space-md)] z-[500] mb-[var(--space-md)]">
      <div className="navbar-pill flex h-16 items-center justify-between gap-[var(--space-sm)] px-[var(--space-xl)]">
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

        <NavEnlaces discord={discord} />

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
            <EnlaceEntrar />
          )}
        </div>
      </div>
    </header>
  );
}
