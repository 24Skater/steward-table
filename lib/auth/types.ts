import type { DefaultSession } from "next-auth";

export type Role = "OWNER" | "ADMIN" | "STAFF" | "COOK" | "DRIVER" | "VIEWER";

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
