import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { conectarPresencia, presencia } from "@/lib/discord-presence";

/**
 * El bot salía en Discord como inactivo y sin actividad. La presencia se mandaba
 * solo dentro del paquete de identificación, donde Discord se la traga a menudo;
 * ahora se reenvía en cuanto la sesión está confirmada.
 *
 * Aquí se prueban las dos mitades: la forma del paquete —que es lo que decide
 * cómo se ve— y que salga por el cable cuando toca, que es lo que fallaba.
 */

const OP = { DISPATCH: 0, IDENTIFY: 2, PRESENCE: 3, HELLO: 10 };

/** Un gateway de mentira: apunta lo que se le manda y deja meterle mensajes. */
class GatewayFalso {
  static ultimo: GatewayFalso | null = null;
  /** `enviar()` compara contra esto antes de escribir: sin ella no manda nada. */
  static OPEN = 1;

  readyState = 1;
  enviados: { op: number; d?: unknown }[] = [];
  private oyentes = new Map<string, ((evento: unknown) => void)[]>();

  constructor() {
    GatewayFalso.ultimo = this;
  }

  addEventListener(nombre: string, oyente: (evento: unknown) => void) {
    const lista = this.oyentes.get(nombre) ?? [];
    lista.push(oyente);
    this.oyentes.set(nombre, lista);
  }

  send(texto: string) {
    this.enviados.push(JSON.parse(texto));
  }

  close() {
    this.readyState = 3;
  }

  /** Lo que Discord nos manda a nosotros. */
  recibir(carga: unknown) {
    for (const oyente of this.oyentes.get("message") ?? []) {
      oyente({ data: JSON.stringify(carga) });
    }
  }
}

describe("presencia del bot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.DISCORD_BOT_TOKEN = "token-de-mentira";
    // El módulo se guarda la conexión ahí para no abrir dos por proceso.
    delete (globalThis as Record<string, unknown>).__novaPresencia;
    (globalThis as Record<string, unknown>).WebSocket = GatewayFalso;
    GatewayFalso.ultimo = null;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    delete (globalThis as Record<string, unknown>).__novaPresencia;
  });

  it("pide salir en verde", () => {
    const puesta = presencia();
    expect(puesta.status).toBe("online");
    expect(puesta.afk).toBe(false);
    // Solo lleva hora quien está ausente: con un número aquí, Discord lo pinta
    // como inactivo aunque el estado diga otra cosa.
    expect(puesta.since).toBeNull();
  });

  it("dice qué está haciendo", () => {
    const [actividad] = presencia().activities;
    expect(actividad.name.length).toBeGreaterThan(0);
    // 3 es «Viendo». Cambiarlo cambia el verbo que sale en Discord.
    expect(actividad.type).toBe(3);
  });

  it("la manda otra vez al confirmarse la sesión", () => {
    conectarPresencia();
    const gateway = GatewayFalso.ultimo!;
    expect(gateway).toBeTruthy();

    gateway.recibir({ op: OP.HELLO, d: { heartbeat_interval: 41250 } });
    expect(gateway.enviados.some((p) => p.op === OP.IDENTIFY)).toBe(true);

    // Hasta aquí, la presencia solo ha viajado dentro del IDENTIFY: es
    // justamente lo que Discord ignoraba.
    expect(gateway.enviados.some((p) => p.op === OP.PRESENCE)).toBe(false);

    gateway.recibir({ op: OP.DISPATCH, t: "READY", s: 1, d: {} });

    const puesta = gateway.enviados.find((p) => p.op === OP.PRESENCE);
    expect(puesta).toBeTruthy();
    expect(puesta!.d).toMatchObject({ status: "online", afk: false, since: null });
  });

  it("no la manda con cualquier otro evento", () => {
    conectarPresencia();
    const gateway = GatewayFalso.ultimo!;

    gateway.recibir({ op: OP.HELLO, d: { heartbeat_interval: 41250 } });
    gateway.recibir({ op: OP.DISPATCH, t: "GUILD_MEMBER_UPDATE", s: 2, d: {} });

    expect(gateway.enviados.some((p) => p.op === OP.PRESENCE)).toBe(false);
  });
});
