import { permanentRedirect } from "next/navigation";

/**
 * La antigua pantalla de solicitudes vive ahora dentro del perfil.
 *
 * Se mantiene la ruta porque los privados de Discord ya enviados apuntan aquí:
 * romperlos dejaría a gente con un enlace muerto en su historial.
 */
export default function MisSolicitudesPage() {
  permanentRedirect("/perfil#solicitudes");
}
