import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";

async function resolveInventoryItem(itemId: string) {
  return db.inventoryItem.findUnique({
    where: { id: itemId },
    select: { id: true, churchId: true, deletedAt: true },
    ...({ _bypassTenancyCheck: true } as object),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { itemId } = await params;

  const body = await req.json().catch(() => null) as {
    quantityOnHand?: number;
    lowStockThreshold?: number | null;
    trackingEnabled?: boolean;
  } | null;

  const existing = await resolveInventoryItem(itemId);
  if (!existing || existing.deletedAt !== null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) =>
      m.churchId === existing.churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("inventory.adjust", {
    userId: session.user.id,
    churchId: existing.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.inventoryItem.update({
    where: { id: itemId, churchId: existing.churchId },
    data: {
      ...(body?.quantityOnHand !== undefined && {
        quantityOnHand: body.quantityOnHand,
      }),
      ...(body?.lowStockThreshold !== undefined && {
        lowStockThreshold: body.lowStockThreshold,
      }),
      ...(body?.trackingEnabled !== undefined && {
        trackingEnabled: body.trackingEnabled,
      }),
    },
    include: {
      item: { select: { name: true } },
    },
  });

  return NextResponse.json({
    id: updated.id,
    itemId: updated.itemId,
    itemName: updated.item.name,
    quantityOnHand: updated.quantityOnHand,
    lowStockThreshold: updated.lowStockThreshold ?? null,
    trackingEnabled: updated.trackingEnabled,
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { itemId } = await params;

  const existing = await resolveInventoryItem(itemId);
  if (!existing || existing.deletedAt !== null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) =>
      m.churchId === existing.churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("inventory.adjust", {
    userId: session.user.id,
    churchId: existing.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.inventoryItem.update({
    where: { id: itemId, churchId: existing.churchId },
    data: { deletedAt: new Date() },
  });

  return new NextResponse(null, { status: 204 });
}
