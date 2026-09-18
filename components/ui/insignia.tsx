import {
  Award,
  Car,
  Crown,
  Drama,
  Gem,
  Ghost,
  Heart,
  Megaphone,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Pista } from "@/components/ui/pista";

/**
 * Iconos que puede llevar una insignia.
 *
 * Es un mapa cerrado a propósito: si aceptásemos cualquier nombre de lucide
 * habría que cargar la librería entera en el navegador, y un nombre mal escrito
 * dejaría la insignia sin dibujo.
 */
export const ICONOS_INSIGNIA: Record<string, LucideIcon> = {
  Award,
  Car,
  Crown,
  Drama,
  Gem,
  Ghost,
  Heart,
  Megaphone,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
};

export const ICONO_POR_DEFECTO = "Award";

export function Insignia({
  nombre,
  icono,
  descripcion,
  size = 14,
  className,
}: {
  nombre: string;
  icono: string;
  descripcion?: string;
  size?: number;
  className?: string;
}) {
  const Icono = ICONOS_INSIGNIA[icono] ?? Award;

  const pastilla = (
    <span className={cn("insignia", className)}>
      <Icono size={size} aria-hidden />
      {nombre}
    </span>
  );

  // Sin explicación no hay nada que enseñar al posar el ratón, y envolverla
  // igualmente dejaría una parada de tabulador que no lleva a ningún sitio.
  if (!descripcion) return pastilla;

  // Arriba porque en el foro y en el perfil las insignias van seguidas: a la
  // derecha, el globo taparía a la siguiente.
  return (
    <Pista texto={descripcion} lado="arriba">
      {pastilla}
    </Pista>
  );
}
