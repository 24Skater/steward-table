import crypto from "node:crypto";
import { db } from "@/lib/db";

const FALLBACK_EXPIRY_DAYS = 30;

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface CreateVolunteerLinkParams {
  catalogId: string;
  churchId: string;
  createdById: string;
}

export interface VolunteerLinkContext {
  catalogId: string;
  churchId: string;
  linkId: string;
}

/** Creates a tokenized volunteer link. Raw token is returned once and never stored. */
export async function createVolunteerLink(
  params: CreateVolunteerLinkParams,
): Promise<{ token: string; linkId: string }> {
  const catalog = (await db.catalog.findFirst({
    where: { id: params.catalogId, churchId: params.churchId },
    select: { id: true, churchId: true, closesAt: true },
  })) as { id: string; churchId: string; closesAt: Date | null } | null;

  if (!catalog) {
    throw new Error("Catalog not found");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt =
    catalog.closesAt ?? new Date(Date.now() + FALLBACK_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const link = (await db.volunteerLink.create({
    data: {
      churchId: params.churchId,
      catalogId: params.catalogId,
      tokenHash: hashToken(token),
      createdById: params.createdById,
      expiresAt,
    },
    select: { id: true },
  })) as { id: string };

  return { token, linkId: link.id };
}

/** Validates a raw token. Returns link context, or null if invalid/expired/revoked/closed. */
export async function validateVolunteerToken(token: string): Promise<VolunteerLinkContext | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;

  const link = (await (db.volunteerLink.findUnique as PrismaBypass)({
    where: { tokenHash: hashToken(token) },
    include: { catalog: { select: { id: true, status: true, churchId: true } } },
    _bypassTenancyCheck: true,
  })) as {
    id: string;
    catalogId: string;
    churchId: string;
    expiresAt: Date;
    revokedAt: Date | null;
    catalog: { id: string; status: string; churchId: string } | null;
  } | null;

  if (!link) return null;
  if (link.revokedAt) return null;
  if (link.expiresAt < new Date()) return null;
  if (link.catalog?.status !== "OPEN") return null;

  return { catalogId: link.catalogId, churchId: link.churchId, linkId: link.id };
}

/** Revokes a link, scoped to the given church and catalog. Idempotent. */
export async function revokeVolunteerLink(
  linkId: string,
  churchId: string,
  catalogId: string,
): Promise<void> {
  const link = (await db.volunteerLink.findFirst({
    where: { id: linkId, churchId, catalogId },
    select: { id: true },
  })) as { id: string } | null;

  if (!link) return;

  try {
    await db.volunteerLink.update({
      where: { id: linkId },
      data: { revokedAt: new Date() },
    });
  } catch (err) {
    // Idempotent — swallow only "record not found" (deleted between lookup and update)
    if ((err as { code?: string }).code !== "P2025") throw err;
  }
}
