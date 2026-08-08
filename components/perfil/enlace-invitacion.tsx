"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Boton } from "@/components/ui/button";

export function EnlaceInvitacion({ enlace }: { enlace: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(enlace);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
      <span className="tile min-w-0 truncate px-[var(--space-sm)] py-[var(--space-2xs)] text-sm">
        {enlace}
      </span>
      <Boton type="button" onClick={copiar}>
        {copiado ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        {copiado ? "Copiado" : "Copiar"}
      </Boton>
    </div>
  );
}
