import path from "node:path";
import { describe, expect, it } from "vitest";
import { guardarDocumento, rutaDeSubida } from "@/lib/uploads";

/**
 * Lo que sube la gente ya no lo sirve Next: el servidor de producción solo
 * reparte los ficheros de `public` que existían al compilar, así que una foto
 * subida después quedaba en disco y daba 404. Ahora la sirve una ruta nuestra,
 * y esta función es la que decide qué nombre se admite.
 *
 * Es la única barrera entre un nombre que llega por la URL y una lectura de
 * disco, así que lo que se prueba aquí sobre todo es lo que NO debe pasar.
 */
describe("rutaDeSubida", () => {
  const dentro = (ruta: string | null) =>
    ruta !== null && ruta.startsWith(path.join(process.cwd(), "public", "uploads"));

  it("acepta el nombre que genera la propia web", () => {
    const nombre = "0f8c1a2e-6b3d-4f7a-9c1e-2d5b8a4f6c30.webp";
    const ruta = rutaDeSubida(nombre);
    expect(dentro(ruta)).toBe(true);
    expect(path.basename(ruta!)).toBe(nombre);
  });

  it("acepta las extensiones de imagen que guardamos", () => {
    for (const nombre of ["foto.webp", "foto.jpg", "foto.jpeg", "foto.png"]) {
      expect(rutaDeSubida(nombre)).not.toBeNull();
    }
  });

  it("acepta la extensión de los documentos PDF", () => {
    expect(rutaDeSubida("contrato.pdf")).not.toBeNull();
  });

  it("no deja salir del directorio", () => {
    for (const nombre of [
      "../nova.db",
      "../../etc/passwd",
      "..",
      "carpeta/foto.webp",
      "..\\windows\\system32",
    ]) {
      expect(rutaDeSubida(nombre)).toBeNull();
    }
  });

  it("no sirve cualquier cosa que haya en el directorio", () => {
    for (const nombre of ["nota.txt", ".env", "server.js", "foto", "foto.webp.exe"]) {
      expect(rutaDeSubida(nombre)).toBeNull();
    }
  });

  it("rechaza lo vacío y lo que empieza por punto", () => {
    expect(rutaDeSubida("")).toBeNull();
    expect(rutaDeSubida(".foto.webp")).toBeNull();
  });
});

describe("guardarDocumento", () => {
  it("rechaza un archivo cuyo contenido no empieza por la cabecera de un PDF", async () => {
    // El Content-Type dice PDF, pero el contenido es cualquier otra cosa: es
    // justo lo que declara el navegador de quien sube, no lo que hay de verdad.
    const falso = new File(["esto no es un PDF, aunque lo diga"], "prueba.pdf", {
      type: "application/pdf",
    });

    await expect(guardarDocumento(falso, "El archivo")).rejects.toThrow(
      "no es un PDF de verdad",
    );
  });
});
