import { describe, expect, it } from "vitest";
import {
  atiende,
  esInvitado,
  estadoTrasMensaje,
  nivelAnterior,
  puedeCerrar,
  puedeEscribir,
  puedeEscribirInterno,
  puedeInvitar,
  puedeMover,
  puedeReabrir,
  puedeValorar,
  puedeVer,
  siguienteNivel,
  type ActorTicket,
  type TicketVisto,
} from "@/lib/tickets/reglas";
import { asuntoDe, CATEGORIAS_TICKET, getCategoriaTicket } from "@/lib/tickets/categorias";
import { componerParticipantes } from "@/lib/tickets/gente";
import { estaMirando, quienesMiran } from "@/lib/tickets/presencia";
import { schemaFor } from "@/lib/forms";
import { notaMedia } from "@/lib/stats";

const jugador: ActorTicket = { id: "u1", role: "USER" };
const otroJugador: ActorTicket = { id: "u2", role: "USER" };
const iniciador: ActorTicket = { id: "s1", role: "INICIADOR" };
const soporte: ActorTicket = { id: "s2", role: "SOPORTE" };
const moderador: ActorTicket = { id: "s3", role: "MODERADOR" };
const admin: ActorTicket = { id: "s4", role: "ADMIN" };

function ticket(cambios: Partial<TicketVisto> = {}): TicketVisto {
  return { authorId: "u1", nivel: "SOPORTE", status: "ABIERTO", ...cambios };
}

describe("quién ve un ticket", () => {
  it("lo ve su autor", () => {
    expect(puedeVer(jugador, ticket())).toBe(true);
  });

  it("no lo ve otro jugador", () => {
    expect(puedeVer(otroJugador, ticket())).toBe(false);
  });

  it("no lo ve quien no ha entrado", () => {
    expect(puedeVer(null, ticket())).toBe(false);
  });

  it("lo ve el staff que llega a su nivel", () => {
    expect(puedeVer(soporte, ticket({ nivel: "SOPORTE" }))).toBe(true);
    expect(puedeVer(moderador, ticket({ nivel: "SOPORTE" }))).toBe(true);
  });

  it("no lo ve el staff que se queda corto", () => {
    expect(puedeVer(iniciador, ticket({ nivel: "SOPORTE" }))).toBe(false);
    expect(puedeVer(moderador, ticket({ nivel: "ADMIN" }))).toBe(false);
  });

  it("una donación solo la ve administración", () => {
    const donacion = ticket({ nivel: "ADMIN", authorId: "u1" });
    expect(atiende(admin, donacion)).toBe(true);
    expect(atiende(moderador, donacion)).toBe(false);
    expect(atiende(soporte, donacion)).toBe(false);
    // Su autor sigue viéndolo: es suyo.
    expect(puedeVer(jugador, donacion)).toBe(true);
  });
});

describe("escribir", () => {
  it("el autor escribe mientras esté vivo", () => {
    expect(puedeEscribir(jugador, ticket())).toBe(true);
  });

  it("cerrado no escribe nadie, ni el staff", () => {
    const cerrado = ticket({ status: "CERRADO" });
    expect(puedeEscribir(jugador, cerrado)).toBe(false);
    expect(puedeEscribir(soporte, cerrado)).toBe(false);
    expect(puedeEscribir(admin, cerrado)).toBe(false);
  });

  it("pero se sigue pudiendo leer", () => {
    expect(puedeVer(jugador, ticket({ status: "CERRADO" }))).toBe(true);
  });

  it("reabrir es cosa del staff que atiende, y solo si está cerrado", () => {
    expect(puedeReabrir(soporte, ticket({ status: "CERRADO" }))).toBe(true);
    expect(puedeReabrir(jugador, ticket({ status: "CERRADO" }))).toBe(false);
    expect(puedeReabrir(iniciador, ticket({ status: "CERRADO" }))).toBe(false);
    expect(puedeReabrir(soporte, ticket({ status: "ABIERTO" }))).toBe(false);
  });

  it("solo el autor valora, y solo con el ticket cerrado", () => {
    const cerrado = ticket({ status: "CERRADO", invitados: ["u2"] });

    expect(puedeValorar(jugador, cerrado)).toBe(true);
    // El invitado entró en una conversación ajena: no es su atención.
    expect(puedeValorar(otroJugador, cerrado)).toBe(false);
    expect(puedeValorar(soporte, cerrado)).toBe(false);
    expect(puedeValorar(admin, cerrado)).toBe(false);
    expect(puedeValorar(null, cerrado)).toBe(false);
    // Todavía abierto: no hay atención que juzgar.
    expect(puedeValorar(jugador, ticket({ status: "ESPERANDO" }))).toBe(false);
  });

  it("no se valora dos veces", () => {
    const valorado = ticket({ status: "CERRADO", valoracion: 4 });
    expect(puedeValorar(jugador, valorado)).toBe(false);
    // Un cero es una nota como otra cualquiera, no un «sin valorar».
    expect(puedeValorar(jugador, ticket({ status: "CERRADO", valoracion: 0 }))).toBe(
      false,
    );
    expect(
      puedeValorar(jugador, ticket({ status: "CERRADO", valoracion: null })),
    ).toBe(true);
  });

  it("las notas internas son solo del staff que atiende", () => {
    expect(puedeEscribirInterno(jugador, ticket())).toBe(false);
    expect(puedeEscribirInterno(iniciador, ticket({ nivel: "SOPORTE" }))).toBe(false);
    expect(puedeEscribirInterno(soporte, ticket({ nivel: "SOPORTE" }))).toBe(true);
  });
});

describe("estado según de quién es el turno", () => {
  it("si contesta el staff, se espera al jugador", () => {
    expect(estadoTrasMensaje(ticket(), "staff")).toBe("ESPERANDO");
  });

  it("si contesta el jugador, vuelve al staff", () => {
    expect(estadoTrasMensaje(ticket({ status: "ESPERANDO" }), "autor")).toBe("EN_CURSO");
  });

  it("una nota interna deja el estado como estaba", () => {
    expect(estadoTrasMensaje(ticket({ status: "ABIERTO" }), "staff", true)).toBe("ABIERTO");
  });
});

describe("cerrar", () => {
  it("puede el autor y puede el staff", () => {
    expect(puedeCerrar(jugador, ticket())).toBe(true);
    expect(puedeCerrar(soporte, ticket())).toBe(true);
  });

  it("no puede quien no lo ve", () => {
    expect(puedeCerrar(otroJugador, ticket())).toBe(false);
    expect(puedeCerrar(iniciador, ticket({ nivel: "MODERADOR" }))).toBe(false);
  });

  it("no se cierra dos veces", () => {
    expect(puedeCerrar(soporte, ticket({ status: "CERRADO" }))).toBe(false);
  });
});

describe("escalado", () => {
  it("los escalones van en orden", () => {
    expect(siguienteNivel("INICIADOR")).toBe("SOPORTE");
    expect(siguienteNivel("SOPORTE")).toBe("MODERADOR");
    expect(siguienteNivel("MODERADOR")).toBe("ADMIN");
    expect(siguienteNivel("ADMIN")).toBeNull();
    expect(nivelAnterior("INICIADOR")).toBeNull();
    expect(nivelAnterior("ADMIN")).toBe("MODERADOR");
  });

  it("se sube de uno en uno", () => {
    const t = ticket({ nivel: "SOPORTE" });
    expect(puedeMover(soporte, t, "MODERADOR")).toBe(true);
    expect(puedeMover(soporte, t, "ADMIN")).toBe(false);
  });

  it("también se puede devolver al escalón de abajo", () => {
    expect(puedeMover(moderador, ticket({ nivel: "MODERADOR" }), "SOPORTE")).toBe(true);
  });

  it("no mueve quien no atiende", () => {
    expect(puedeMover(jugador, ticket(), "MODERADOR")).toBe(false);
    expect(puedeMover(iniciador, ticket({ nivel: "SOPORTE" }), "MODERADOR")).toBe(false);
  });

  it("no se sale por arriba", () => {
    expect(puedeMover(admin, ticket({ nivel: "ADMIN" }), "ADMIN")).toBe(false);
  });
});

describe("categorías", () => {
  it("cada una nace en un escalón conocido", () => {
    for (const categoria of CATEGORIAS_TICKET) {
      expect(["INICIADOR", "SOPORTE", "MODERADOR", "ADMIN"]).toContain(categoria.nivel);
    }
  });

  it("todas preguntan el asunto, que es lo que se lista", () => {
    for (const categoria of CATEGORIAS_TICKET) {
      expect(categoria.campos[0].name).toBe("asunto");
    }
  });

  it("las claves no se repiten", () => {
    const claves = CATEGORIAS_TICKET.map((categoria) => categoria.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("el asunto cae en el nombre de la categoría si viene vacío", () => {
    const duda = getCategoriaTicket("duda")!;
    expect(asuntoDe(duda, { asunto: "  " })).toBe("Duda o ayuda");
    expect(asuntoDe(duda, { asunto: "No conecto" })).toBe("No conecto");
  });

  it("sus preguntas validan con el mismo motor que las solicitudes", () => {
    const reporte = getCategoriaTicket("reporte")!;
    const esquema = schemaFor({
      type: reporte.clave,
      title: reporte.nombre,
      summary: reporte.descripcion,
      version: 1,
      fields: reporte.campos,
    });

    expect(esquema.safeParse({ asunto: "corto" }).success).toBe(false);
    expect(
      esquema.safeParse({
        asunto: "DM en el centro",
        reportado: "Juan Pérez",
        cuando: "Hoy a las 22:30",
        detalle: "x".repeat(40),
        pruebas: "",
      }).success,
    ).toBe(true);
  });
});

describe("tickets entre varios", () => {
  const conInvitado = () => ticket({ invitados: ["u2"] });

  it("el invitado lo ve y escribe", () => {
    expect(esInvitado(otroJugador, conInvitado())).toBe(true);
    expect(puedeVer(otroJugador, conInvitado())).toBe(true);
    expect(puedeEscribir(otroJugador, conInvitado())).toBe(true);
  });

  it("quien no está invitado sigue fuera", () => {
    expect(puedeVer({ id: "u9", role: "USER" }, conInvitado())).toBe(false);
  });

  it("el invitado no cierra ni invita: está de paso", () => {
    expect(puedeCerrar(otroJugador, conInvitado())).toBe(false);
    expect(puedeInvitar(otroJugador, conInvitado())).toBe(false);
  });

  it("dentro del ticket solo mueve gente el staff que atiende", () => {
    // El autor dijo con quién iba al abrirlo; a partir de ahí, no.
    expect(puedeInvitar(jugador, ticket())).toBe(false);
    expect(puedeInvitar(soporte, ticket())).toBe(true);
    expect(puedeInvitar(iniciador, ticket({ nivel: "SOPORTE" }))).toBe(false);
  });

  it("en uno cerrado ya no se mete a nadie", () => {
    expect(puedeInvitar(soporte, ticket({ status: "CERRADO" }))).toBe(false);
  });

  it("sin invitados la lista no existe y nadie cuela", () => {
    expect(esInvitado(otroJugador, ticket())).toBe(false);
  });
});

describe("quién está dentro del ticket", () => {
  const autor = {
    id: "u1",
    username: "only",
    avatar: null,
    role: "USER" as const,
    staffTag: null,
  };
  const invitado = { ...autor, id: "u2", username: "Vito" };
  const revisor = {
    ...autor,
    id: "s2",
    username: "Ana",
    role: "SOPORTE" as const,
  };

  it("pone al autor primero, luego a los invitados y por último al staff", () => {
    const gente = componerParticipantes({
      autor,
      invitados: [invitado],
      autoresDeMensajes: [autor, revisor, autor],
    });

    expect(gente.map((persona) => [persona.username, persona.papel])).toEqual([
      ["only", "autor"],
      ["Vito", "invitado"],
      ["Ana", "staff"],
    ]);
  });

  it("marca a quien tiene el ticket abierto ahora", () => {
    const gente = componerParticipantes({
      autor,
      invitados: [invitado],
      autoresDeMensajes: [autor, revisor],
      presentes: [invitado],
    });

    expect(gente.map((persona) => [persona.username, persona.mirando])).toEqual([
      ["only", false],
      ["Vito", true],
      ["Ana", false],
    ]);
  });

  it("saca al staff que está mirando aunque no haya escrito", () => {
    const gente = componerParticipantes({
      autor,
      invitados: [],
      autoresDeMensajes: [autor],
      presentes: [revisor],
    });

    expect(gente.map((persona) => [persona.username, persona.papel])).toEqual([
      ["only", "autor"],
      ["Ana", "staff"],
    ]);
  });

  it("no repite a quien escribe varias veces", () => {
    const gente = componerParticipantes({
      autor,
      invitados: [],
      autoresDeMensajes: [revisor, revisor, revisor],
    });

    expect(gente).toHaveLength(2);
  });

  it("el staff que solo lee no sale: no consta en ninguna parte", () => {
    const gente = componerParticipantes({
      autor,
      invitados: [],
      autoresDeMensajes: [autor],
    });

    expect(gente.map((persona) => persona.username)).toEqual(["only"]);
  });
});

describe("presencia", () => {
  const AHORA = new Date("2026-08-01T12:00:00Z");
  const haceSegundos = (n: number) => new Date(AHORA.getTime() - n * 1000);

  it("quien acaba de latir está mirando", () => {
    expect(estaMirando(haceSegundos(5), AHORA)).toBe(true);
  });

  it("aguanta tres latidos perdidos", () => {
    expect(estaMirando(haceSegundos(59), AHORA)).toBe(true);
    expect(estaMirando(haceSegundos(61), AHORA)).toBe(false);
  });

  it("resuelve la lista de los que siguen delante", () => {
    const presentes = quienesMiran(
      [
        { userId: "u1", seenAt: haceSegundos(3) },
        { userId: "u2", seenAt: haceSegundos(600) },
      ],
      AHORA,
    );

    expect([...presentes]).toEqual(["u1"]);
  });
});

describe("notaMedia", () => {
  it("quita el decimal cuando la media es redonda", () => {
    expect(notaMedia(5)).toBe("5");
    expect(notaMedia(0)).toBe("0");
  });

  it("deja un decimal cuando lo hay", () => {
    expect(notaMedia(4.25)).toBe("4.3");
    expect(notaMedia(3.5)).toBe("3.5");
  });

  it("sin valoraciones no inventa un cero", () => {
    expect(notaMedia(null)).toBe("—");
  });
});
