import "server-only";
import { resumenAvisos } from "@/lib/avisos";
import { hace } from "@/lib/utils";
import type { AvisoVisto } from "@/components/campana";

/**
 * Deja los avisos listos para la campana.
 *
 * Las fechas se convierten a texto aquí, en el servidor: la campana es un
 * componente de cliente y, si calculara ella el "hace 5 min", lo primero que
 * pintaría el navegador no coincidiría con lo que llegó del servidor.
 */
export async function avisosParaCampana(
  userId: string,
): Promise<{ avisos: AvisoVisto[]; sinLeer: number }> {
  const { sinLeer, ultimos } = await resumenAvisos(userId);

  return {
    sinLeer,
    avisos: ultimos.map((aviso) => ({
      id: aviso.id,
      kind: aviso.kind,
      title: aviso.title,
      body: aviso.body,
      url: aviso.url,
      cuando: hace(aviso.createdAt),
      leido: aviso.readAt !== null,
    })),
  };
}
