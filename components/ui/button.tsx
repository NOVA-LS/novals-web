import Link from "next/link";
import { cn } from "@/lib/utils";

type Variante = "primary" | "outline" | "ghost" | "danger";

function clases(variante: Variante, className?: string) {
  return cn(
    "btn",
    variante === "primary" && "btn--primary",
    variante === "ghost" && "btn--ghost",
    variante === "danger" && "btn--danger",
    className,
  );
}

type BotonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
};

export function Boton({
  variante = "outline",
  className,
  ...props
}: BotonProps) {
  return <button className={clases(variante, className)} {...props} />;
}

type EnlaceBotonProps = React.ComponentProps<typeof Link> & {
  variante?: Variante;
};

export function EnlaceBoton({
  variante = "outline",
  className,
  ...props
}: EnlaceBotonProps) {
  return <Link className={clases(variante, className)} {...props} />;
}
