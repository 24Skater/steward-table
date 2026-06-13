import { auth } from "@/lib/auth";
import type { SessionMembership, Role } from "./types";

/**
 * Get the current session or throw if unauthenticated.
 * Use in server components and route handlers.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthenticated");
  }
  return session;
}

/**
 * Resolve the active church membership for a given churchId.
 * Returns null if the user has no active membership for that church.
 */
export function resolveChurchMembership(
  memberships: SessionMembership[],
  churchId: string,
): SessionMembership | null {
  return memberships.find((m) => m.churchId === churchId && m.status === "ACTIVE") ?? null;
}

/**
 * Get the effective roles for a user at a given church.
 * Returns empty array if no membership exists.
 */
export function getEffectiveRoles(
  memberships: SessionMembership[],
  churchId: string,
): Role[] {
  const membership = resolveChurchMembership(memberships, churchId);
  return membership?.roles ?? [];
}
