import Image from "next/image";
import Link from "next/link";
import { Globe } from "lucide-react";
import { redirect } from "next/navigation";
import { currentUser, isStaff } from "@/lib/guards";
import { avisosParaCampana } from "@/lib/avisos-vista";
import { Campana } from "@/components/campana";
import { TiempoReal } from "@/components/tiempo-real";
import { MenuUsuario } from "@/components/menu-usuario";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await currentUser();
  if (!usuario) redirect("/entrar?callbackUrl=/panel");
  if (!isStaff(usuario.role)) redirect("/");

  const campana = await avisosParaCampana(usuario.id);

  return (
    <div className="canvas flex min-h-full flex-1 flex-col">
      {/* Lo que entra en las bandejas aparece sin tocar nada. */}
      <TiempoReal />
      <header className="sticky top-0 z-[500] border-b border-[var(--color-rule)] bg-[color-mix(in_oklch,var(--color-paper)_82%,transparent)] backdrop-blur-md">
        {/* Las secciones no se repiten aquí: viven en el resumen, y al resumen
            se vuelve por el logo. */}
        <div className="shell flex h-16 items-center justify-between gap-[var(--space-sm)]">
          <Link
            href="/panel"
            aria-label="NOVA Los Santos · panel"
            className="shrink-0"
          >
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
            {/* La vuelta a la web, junto a la campana: mismo tratamiento que
                el salto al panel del lado público, solo el icono. */}
            <Link
              href="/"
              className="menu__boton menu__boton--icono"
              aria-label="Volver a la web"
            >
              <Globe size={18} aria-hidden />
            </Link>

            <Campana avisos={campana.avisos} sinLeer={campana.sinLeer} />
            <MenuUsuario
              nombre={usuario.username}
              avatar={usuario.avatar}
              rol={usuario.role}
            />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
