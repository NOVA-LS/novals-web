import {
  CalendarDays,
  Code2,
  Gavel,
  Megaphone,
  Scale,
  ShoppingBag,
  Skull,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EQUIPO_NOMBRE, EQUIPOS } from "@/lib/equipos";
import type { StaffTag } from "@/generated/prisma/enums";

/** Cara de cada equipo. Los nombres viven en lib/equipos.ts, con la lista. */
const ICONOS: Record<StaffTag, LucideIcon> = {
  DEV: Code2,
  ILEGAL: Skull,
  LEGAL: Scale,
  COMERCIO: ShoppingBag,
  REDES: Megaphone,
  EVENTOS: CalendarDays,
  REPORTES: Gavel,
};

/**
 * Distintivo de equipo, al lado del rol.
 *
 * No dice qué puede hacer alguien —de eso va el rol— sino a qué se dedica. Va
 * con icono además de color: el verde por sí solo no lo distingue todo el mundo
 * del verde de la whitelist, que aparece en la misma línea.
 */
export function EtiquetaStaff({
  tag,
  menudo = false,
}: {
  tag: StaffTag | null | undefined;
  /** Para cuando va pegada a un nombre y no debe pesar más que él. */
  menudo?: boolean;
}) {
  if (!tag) return null;

  const Icono = ICONOS[tag];

  return (
    <Badge tono="dev" className={menudo ? "badge--menudo" : undefined}>
      <Icono size={menudo ? 11 : 13} aria-hidden />
      {EQUIPO_NOMBRE[tag]}
    </Badge>
  );
}

/** Todos los equipos de alguien, en el orden del catálogo. */
export function EtiquetasStaff({
  tags,
  menudo = false,
}: {
  tags: StaffTag[];
  menudo?: boolean;
}) {
  const suyos = EQUIPOS.filter((equipo) => tags.includes(equipo));
  if (suyos.length === 0) return null;

  return (
    <>
      {suyos.map((equipo) => (
        <EtiquetaStaff key={equipo} tag={equipo} menudo={menudo} />
      ))}
    </>
  );
}
