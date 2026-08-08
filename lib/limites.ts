/**
 * Límites de subida.
 *
 * Viven aparte porque los lee tanto la validación del servidor como
 * `next.config.ts`: si el cuerpo que acepta Next se queda por debajo de lo que
 * permitimos subir, la petición muere antes de llegar a nuestro mensaje de
 * error y el staff solo ve un fallo de Next.
 *
 * Este módulo no puede importar nada: `next.config.ts` se carga antes que los
 * alias de TypeScript y que cualquier dependencia de la aplicación.
 */

/** Portada de una noticia: se ve a un ancho fijo, no necesita más. */
export const MAX_IMAGEN_MB = 4;

/** Foto de galería: va a pantalla completa en la portada y pesa bastante más. */
export const MAX_FOTO_MB = 10;

/** Imágenes que se pueden colgar de un mensaje de ticket. */
export const MAX_ADJUNTOS = 3;

/** Fotos de galería que se admiten en una sola tanda. */
export const MAX_IMAGENES_POR_TANDA = 10;

/**
 * Lado mayor con el que se guarda una imagen.
 *
 * Lo que se sube es el original de una captura, que puede venir en 4K; lo que se
 * enseña nunca pasa del ancho de la pantalla. Recortar aquí ahorra disco sin que
 * se note en pantalla, y next/image sigue sirviendo tamaños menores desde este.
 */
export const MAX_LADO_PX = 2560;

/**
 * Cuerpo máximo de una Server Action: la tanda entera más un margen para los
 * separadores multipart y el resto de campos del formulario.
 *
 * Next se guarda el cuerpo en memoria mientras lo recibe, así que este número es
 * también la memoria que puede comerse una subida. Si aprieta, lo que hay que
 * bajar es MAX_IMAGENES_POR_TANDA, no el tamaño por foto.
 */
export const MAX_CUERPO_MB = MAX_FOTO_MB * MAX_IMAGENES_POR_TANDA + 2;
