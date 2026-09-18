import { ShieldCheck } from "lucide-react";
import { ROL_TEXTO } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@/generated/prisma/enums";

/**
 * El rol de alguien, allí donde importa saber con quién se habla.
 *
 * Se enseña en el foro y dentro de un ticket: ahí lo que hace falta es saber si
 * quien contesta es moderación o administración. El distintivo de equipo
 * —«Programador» y los que vengan— no pinta nada en esas dos pantallas y vive
 * solo en el perfil, que es donde se cuenta quién es cada uno.
 */
export function RolStaff({ rol }: { rol: Role }) {
  if (rol === "USER") return null;

  // Menuda a propósito: va pegada a un nombre y no debe pesar más que él.
  return (
    <Badge tono="review" className="badge--menudo">
      <ShieldCheck size={11} aria-hidden />
      {ROL_TEXTO[rol]}
    </Badge>
  );
}
