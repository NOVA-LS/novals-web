import { describe, expect, it } from "vitest";
import { mencionTapada, rolesMencionables } from "@/lib/discord/menciones";

describe("rolesMencionables", () => {
  it("quita @everyone y los roles de integraciones, y ordena de más alto a más bajo", () => {
    const roles = rolesMencionables(
      [
        { id: "1", name: "@everyone", position: 0, managed: false },
        { id: "2", name: "Jugadores", position: 2, managed: false },
        { id: "3", name: "Bot", position: 5, managed: true },
        { id: "4", name: "Staff", position: 7, managed: false },
      ],
      "1",
    );

    expect(roles.map((rol) => rol.name)).toEqual(["Staff", "Jugadores"]);
  });
});

describe("mencionTapada", () => {
  it("tapa la mención con un spoiler", () => {
    expect(mencionTapada("123456789012345678")).toBe("||<@&123456789012345678>||");
  });

  it("sin rol, o con algo que no es un id de Discord, no hay mención", () => {
    expect(mencionTapada()).toBeNull();
    expect(mencionTapada(null)).toBeNull();
    expect(mencionTapada("everyone>")).toBeNull();
  });
});
