"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";

/** El enlace de "Entrar" del navbar, marcado igual que el resto cuando ya estás en /entrar. */
export function EnlaceEntrar() {
  const pathname = usePathname();
  const activo = pathname === "/entrar";

  return (
    <Link
      href="/entrar"
      data-activo={activo ? "true" : undefined}
      className="nav-link nav-link--cabecera flex items-center gap-[var(--space-2xs)]"
    >
      <LogIn size={15} aria-hidden />
      Entrar
    </Link>
  );
}
