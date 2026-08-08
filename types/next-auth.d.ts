import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      discordId: string;
      role: Role;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    discordId?: string;
    role?: Role;
    /** Cuándo se leyó el rol de la base por última vez. */
    visto?: number;
  }
}

export {};
