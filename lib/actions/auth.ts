"use server";

import { signIn, signOut } from "@/lib/auth";

// Las acciones de sesión viven en un módulo propio con "use server" de nivel
// superior. Declaradas en línea dentro de la cabecera no se registran, porque
// la cabecera la renderiza el layout y no la página: al enviarlas el servidor
// respondía 404 "Server action not found".
//
// El destino viaja en un campo oculto del formulario en vez de como argumento
// ligado: los argumentos ligados se cifran y obligan al cliente a mandar el
// flujo RSC completo, que es justo lo que se rompía.

export async function entrarConDiscord(datos: FormData) {
  const pedido = String(datos.get("destino") ?? "");
  // Solo una ruta propia: "//evil.com" o "https://evil.com" parecen relativas
  // a primera vista pero el navegador las trata como absolutas.
  const destino =
    pedido.startsWith("/") && !pedido.startsWith("//") ? pedido : "/formularios";
  await signIn("discord", { redirectTo: destino });
}

export async function salir() {
  await signOut({ redirectTo: "/" });
}
