import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Foto de perfil de Discord.
 *
 * Quien no tiene avatar cae en la inicial de su nombre: nunca se enseña un
 * hueco roto ni un icono genérico que parezca un fallo de carga.
 */
export function Avatar({
  src,
  nombre,
  size = 32,
  className,
  prioridad = false,
}: {
  src?: string | null;
  nombre: string;
  size?: number;
  className?: string;
  /** Para el único avatar que sale siempre por encima del pliegue: la cabecera del perfil. */
  prioridad?: boolean;
}) {
  const estilo = { width: size, height: size } as React.CSSProperties;

  if (!src) {
    return (
      <span
        className={cn("avatar avatar--inicial", className)}
        style={{ ...estilo, fontSize: size * 0.42 }}
        aria-hidden
      >
        {nombre.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn("avatar", className)}
      style={estilo}
      priority={prioridad}
      // Decorativo: el nombre siempre va al lado en texto.
      aria-hidden
    />
  );
}
