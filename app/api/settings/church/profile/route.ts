import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";

const putSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(63)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
  timezone: z.string().min(1),
  legalName: z.string().max(200).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Accent color must be a valid hex color").nullable().optional(),
  replyToEmail: z.string().email().nullable().optional(),
  displayName: z.string().max(100).nullable().optional(),
  customerSelfCancelWindowMinutes: z.number().int().min(0).max(1440).optional(),
  smsEnabled: z.boolean().optional(),
  locale: z.enum(["EN", "ES"]).optional(),
});

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canResult = await can("church.update", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!canResult.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawBody = await req.json().catch(() => null);
  if (!rawBody) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }

  const {
    name,
    slug,
    timezone,
    legalName,
    logoUrl,
    accentColor,
    replyToEmail,
    displayName,
    customerSelfCancelWindowMinutes,
    smsEnabled,
    locale,
  } = parsed.data;

  const [updatedChurch] = await Promise.all([
    (db.church.update as Function)({
      where: { id: membership.churchId, ...({ _bypassTenancyCheck: true } as object) },
      data: {
        name,
        slug,
        timezone,
        ...(legalName !== undefined && { legalName }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(accentColor !== undefined && { accentColor }),
        ...(locale !== undefined && { locale }),
      },
      select: { id: true, name: true, slug: true, timezone: true, legalName: true, logoUrl: true, accentColor: true, locale: true },
    }),
    (db.churchSettings.upsert as Function)({
      where: { churchId: membership.churchId, ...({ _bypassTenancyCheck: true } as object) },
      create: {
        churchId: membership.churchId,
        ...(replyToEmail !== undefined && { replyToEmail }),
        ...(displayName !== undefined && { displayName }),
        ...(customerSelfCancelWindowMinutes !== undefined && {
          customerSelfCancelWindowMinutes,
        }),
        ...(smsEnabled !== undefined && { smsEnabled }),
      },
      update: {
        ...(replyToEmail !== undefined && { replyToEmail }),
        ...(displayName !== undefined && { displayName }),
        ...(customerSelfCancelWindowMinutes !== undefined && {
          customerSelfCancelWindowMinutes,
        }),
        ...(smsEnabled !== undefined && { smsEnabled }),
      },
    }),
  ]);

  return NextResponse.json({ success: true, church: updatedChurch });
}
