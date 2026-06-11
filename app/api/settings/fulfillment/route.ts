import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";

interface FulfillmentPrefs {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  dineInEnabled: boolean;
  deliveryRadiusMiles: number | null;
  pickupInstructions: string | null;
}

function parseFulfillmentPrefs(brandTokens: unknown): FulfillmentPrefs {
  if (!brandTokens || typeof brandTokens !== "object") {
    return {
      pickupEnabled: true,
      deliveryEnabled: false,
      dineInEnabled: false,
      deliveryRadiusMiles: null,
      pickupInstructions: null,
    };
  }
  const raw = brandTokens as Record<string, unknown>;
  return {
    pickupEnabled: typeof raw.pickupEnabled === "boolean" ? raw.pickupEnabled : true,
    deliveryEnabled: typeof raw.deliveryEnabled === "boolean" ? raw.deliveryEnabled : false,
    dineInEnabled: typeof raw.dineInEnabled === "boolean" ? raw.dineInEnabled : false,
    deliveryRadiusMiles:
      typeof raw.deliveryRadiusMiles === "number" ? raw.deliveryRadiusMiles : null,
    pickupInstructions:
      typeof raw.pickupInstructions === "string" ? raw.pickupInstructions : null,
  };
}

export async function GET() {
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

  const settings = await (db.churchSettings.findUnique as Function)({
    where: { churchId: membership.churchId },
    select: { brandTokens: true },
    _bypassTenancyCheck: true,
  });

  return NextResponse.json(parseFulfillmentPrefs(settings?.brandTokens));
}

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

  const body = await req.json().catch(() => null) as Partial<FulfillmentPrefs> | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Fetch existing settings to merge
  const existing = await (db.churchSettings.findUnique as Function)({
    where: { churchId: membership.churchId },
    select: { brandTokens: true },
    _bypassTenancyCheck: true,
  });

  const current = parseFulfillmentPrefs(existing?.brandTokens);
  const merged: FulfillmentPrefs = {
    pickupEnabled: body.pickupEnabled ?? current.pickupEnabled,
    deliveryEnabled: body.deliveryEnabled ?? current.deliveryEnabled,
    dineInEnabled: body.dineInEnabled ?? current.dineInEnabled,
    deliveryRadiusMiles:
      body.deliveryRadiusMiles !== undefined ? body.deliveryRadiusMiles : current.deliveryRadiusMiles,
    pickupInstructions:
      body.pickupInstructions !== undefined ? body.pickupInstructions : current.pickupInstructions,
  };

  // Merge with existing brandTokens to preserve non-fulfillment data
  const existingTokens =
    existing?.brandTokens && typeof existing.brandTokens === "object"
      ? (existing.brandTokens as Record<string, unknown>)
      : {};

  const updatedTokens = { ...existingTokens, ...merged };

  await (db.churchSettings.upsert as Function)({
    where: { churchId: membership.churchId },
    create: {
      churchId: membership.churchId,
      brandTokens: updatedTokens,
    },
    update: {
      brandTokens: updatedTokens,
    },
    _bypassTenancyCheck: true,
  });

  return NextResponse.json(merged);
}
