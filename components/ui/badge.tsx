import { Check, Clock, Eye, X, type LucideIcon } from "lucide-react";
import type { Status } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

// El icono acompaña al color: quien no distingue el verde del rojo sigue
// leyendo el estado de un vistazo.
const ESTADO: Record<Status, { texto: string; clase: string; Icono: LucideIcon }> = {
  PENDING: { texto: "Pendiente", clase: "badge--pending", Icono: Clock },
  IN_REVIEW: { texto: "En revisión", clase: "badge--review", Icono: Eye },
  ACCEPTED: { texto: "Aceptada", clase: "badge--accepted", Icono: Check },
  REJECTED: { texto: "Rechazada", clase: "badge--rejected", Icono: X },
};

export function EstadoBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const { texto, clase, Icono } = ESTADO[status];
  return (
    <span className={cn("badge", clase, className)}>
      <Icono size={13} aria-hidden />
      {texto}
    </span>
  );
}

export function Badge({
  children,
  tono = "neutral",
  className,
}: {
  children: React.ReactNode;
  tono?: "neutral" | "pending" | "review" | "accepted" | "rejected" | "dev";
  className?: string;
}) {
  return (
    <span className={cn("badge", `badge--${tono}`, className)}>{children}</span>
  );
}

export const ESTADO_TEXTO = ESTADO;
