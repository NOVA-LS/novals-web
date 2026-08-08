import "server-only";

/**
 * Mantiene el bot en línea en Discord y escucha los cambios de roles.
 *
 * La presencia solo existe mientras hay una conexión de gateway abierta, así que
 * la web sostiene un WebSocket con lo mínimo del protocolo: identificarse, latir
 * y reconectar cuando se corta.
 *
 * Ya que la conexión está abierta, se aprovecha para enterarse al instante de
 * los ascensos hechos en Discord: se pide el intent de miembros y se escuchan
 * sus altas, bajas y cambios de rol. Quien decide qué significa cada rol es
 * `lib/discord/`; aquí solo se traduce «a esta persona le han tocado los roles»
 * en «vuelve a mirarla».
 *
 * No implementamos RESUME a propósito: un evento perdido en una reconexión no
 * es grave —al iniciar sesión y con el botón del panel se vuelve a leer todo— y
 * arrastrar el estado de sesión es bastante más que mantener.
 */

const GATEWAY = "wss://gateway.discord.gg/?v=10&encoding=json";

const OP = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  PRESENCE: 3,
  RECONNECT: 7,
  INVALID_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
} as const;

/**
 * Cierres que no se arreglan reintentando: el token es malo o la configuración
 * de la aplicación no cuadra. Insistir solo genera ruido en el log.
 */
const CIERRES_DEFINITIVOS = new Set([4004, 4010, 4011, 4012, 4013, 4014]);

const ESPERA_MAX_MS = 60_000;

type Conexion = {
  ws: WebSocket | null;
  latido: ReturnType<typeof setInterval> | null;
  arranque: ReturnType<typeof setTimeout> | null;
  reintento: ReturnType<typeof setTimeout> | null;
  secuencia: number | null;
  esperandoAck: boolean;
  intentos: number;
  detenida: boolean;
};

declare global {
  // El hot reload de desarrollo reevalúa el módulo; sin esto acabaríamos con una
  // conexión nueva por recarga y Discord acabaría cortando por exceso.
  var __novaPresencia: Conexion | undefined;
}

export function conectarPresencia() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return;
  if (globalThis.__novaPresencia) return;

  const conexion: Conexion = {
    ws: null,
    latido: null,
    arranque: null,
    reintento: null,
    secuencia: null,
    esperandoAck: false,
    intentos: 0,
    detenida: false,
  };

  globalThis.__novaPresencia = conexion;
  abrir(conexion, token);
}

function abrir(conexion: Conexion, token: string) {
  if (conexion.detenida) return;

  const ws = new WebSocket(GATEWAY);
  conexion.ws = ws;

  ws.addEventListener("message", (evento) => {
    let paquete: { op: number; d?: unknown; s?: number | null };

    try {
      paquete = JSON.parse(String(evento.data));
    } catch {
      return;
    }

    if (typeof paquete.s === "number") conexion.secuencia = paquete.s;

    switch (paquete.op) {
      case OP.HELLO: {
        const { heartbeat_interval: intervalo } = paquete.d as {
          heartbeat_interval: number;
        };
        empezarLatido(conexion, intervalo);
        enviar(ws, { op: OP.IDENTIFY, d: identidad(token) });
        break;
      }

      case OP.HEARTBEAT:
        latir(conexion);
        break;

      case OP.HEARTBEAT_ACK:
        conexion.esperandoAck = false;
        // Solo damos la conexión por buena cuando Discord contesta.
        conexion.intentos = 0;
        break;

      case OP.RECONNECT:
      case OP.INVALID_SESSION:
        ws.close(4000, "Discord pidió reconectar");
        break;

      case OP.DISPATCH: {
        const despacho = paquete as { t?: string; d?: unknown };

        // La presencia que va dentro del IDENTIFY se pierde a menudo, y el bot
        // se queda en la lista como inactivo y sin actividad. Reenviarla en
        // cuanto Discord confirma la sesión es lo que la deja en verde. Vale
        // también para las reconexiones: READY llega en todas.
        if (despacho.t === "READY") enviar(ws, { op: OP.PRESENCE, d: presencia() });

        atender(despacho);
        break;
      }
    }
  });

  ws.addEventListener("error", () => {
    // El cierre llega igualmente; aquí solo evitamos que el evento suba sin manejar.
  });

  ws.addEventListener("close", (evento) => {
    pararLatido(conexion);
    conexion.ws = null;

    if (CIERRES_DEFINITIVOS.has(evento.code)) {
      conexion.detenida = true;
      console.error(
        `Presencia de Discord detenida: cierre ${evento.code}. Revisa DISCORD_BOT_TOKEN.`,
      );
      return;
    }

    reconectar(conexion, token);
  });
}

/** GUILD_MEMBERS. Es un intent privilegiado: hay que encenderlo en el portal. */
const INTENT_MIEMBROS = 1 << 1;

/**
 * Reparte los eventos que sí nos interesan.
 *
 * Nunca espera al resultado ni deja subir un fallo: el gateway tiene que seguir
 * latiendo pase lo que pase con la base de datos.
 */
function atender(paquete: { t?: string; d?: unknown }) {
  const eventos = ["GUILD_MEMBER_UPDATE", "GUILD_MEMBER_ADD", "GUILD_MEMBER_REMOVE"];
  if (!paquete.t || !eventos.includes(paquete.t)) return;

  const datos = paquete.d as {
    guild_id?: string;
    user?: { id?: string };
  };

  const servidor = process.env.DISCORD_GUILD_ID?.trim();
  if (servidor && datos.guild_id !== servidor) return;

  const discordId = datos.user?.id;
  if (!discordId) return;

  // La importación va aquí dentro para no arrastrar la base de datos hasta este
  // módulo, que se carga al arrancar el servidor.
  void import("@/lib/discord/sincronizar")
    .then(({ traerDeDiscordPorDiscordId }) => traerDeDiscordPorDiscordId(discordId))
    .catch((error) => {
      console.error("No se pudo atender un cambio de roles de Discord", error);
    });
}

/**
 * Cómo queremos que se vea el bot en la lista de miembros.
 *
 * Se manda dos veces: en el IDENTIFY y otra vez al llegar el READY. Con solo la
 * primera, Discord lo dejaba como inactivo y sin actividad ninguna.
 */
export function presencia() {
  return {
    // Solo lleva hora quien está ausente de verdad.
    since: null,
    afk: false,
    status: "online",
    // type 3 es «Viendo».
    activities: [{ name: "Revisando solicitudes ...", type: 3 }],
  };
}

function identidad(token: string) {
  return {
    token,
    // Solo miembros: es lo único que escuchamos.
    intents: INTENT_MIEMBROS,
    properties: { os: "linux", browser: "nova-ls", device: "nova-ls" },
    presence: presencia(),
  };
}

function empezarLatido(conexion: Conexion, intervalo: number) {
  pararLatido(conexion);

  // Discord pide repartir el primer latido dentro del intervalo para que no
  // lleguen todos los bots a la vez.
  conexion.arranque = setTimeout(() => {
    latir(conexion);
    conexion.latido = setInterval(() => {
      if (conexion.esperandoAck) {
        // Sin respuesta al latido anterior la conexión está muerta aunque el
        // socket siga abierto: cortamos para que el cierre dispare la reconexión.
        conexion.ws?.close(4000, "Sin respuesta al latido");
        return;
      }
      latir(conexion);
    }, intervalo);
  }, intervalo * Math.random());
}

function latir(conexion: Conexion) {
  if (!conexion.ws) return;
  conexion.esperandoAck = true;
  enviar(conexion.ws, { op: OP.HEARTBEAT, d: conexion.secuencia });
}

function pararLatido(conexion: Conexion) {
  if (conexion.arranque) clearTimeout(conexion.arranque);
  if (conexion.latido) clearInterval(conexion.latido);
  conexion.arranque = null;
  conexion.latido = null;
  conexion.esperandoAck = false;
}

function reconectar(conexion: Conexion, token: string) {
  if (conexion.detenida || conexion.reintento) return;

  conexion.intentos += 1;
  const espera = Math.min(1000 * 2 ** (conexion.intentos - 1), ESPERA_MAX_MS);

  conexion.reintento = setTimeout(() => {
    conexion.reintento = null;
    abrir(conexion, token);
  }, espera);
}

function enviar(ws: WebSocket, carga: unknown) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(carga));
}
