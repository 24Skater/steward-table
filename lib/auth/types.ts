import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

export interface SessionMembership {
  id: string;
  churchId: string;
  roles: Role[];
  status: string;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      memberships: SessionMembership[];
    } & DefaultSession["user"];
  }
}
