import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";

const patchSchema = z.object({
  tipEnabled: z.boolean(),
  tipPercentages: z.array(z.number().int().min(1).max(100)).min(1).max(8),
});

export async function PATCH(req: NextRequest) {
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

  const result = await can("settings.payment", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawBody = await req.json().catch(() => null);
  if (!rawBody) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }

  const { tipEnabled, tipPercentages } = parsed.data;

  const existing = await (db.churchSettings.findUnique as Function)({
    where: { churchId: membership.churchId },
    select: { brandTokens: true },
    _bypassTenancyCheck: true,
  });

  const existingTokens =
    existing?.brandTokens && typeof existing.brandTokens === "object"
      ? (existing.brandTokens as Record<string, unknown>)
      : {};

  const updatedTokens = { ...existingTokens, tipEnabled, tipPercentages };

  await (db.churchSettings.upsert as Function)({
    where: { churchId: membership.churchId },
    create: { churchId: membership.churchId, brandTokens: updatedTokens },
    update: { brandTokens: updatedTokens },
    _bypassTenancyCheck: true,
  });

  return NextResponse.json({ tipEnabled, tipPercentages });
}
