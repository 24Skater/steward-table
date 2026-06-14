import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const churchId = req.nextUrl.searchParams.get("churchId");
  if (!churchId) {
    return NextResponse.json({ error: "Missing churchId" }, { status: 400 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("inventory.read", {
    userId: session.user.id,
    churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await db.inventoryItem.findMany({
    where: { churchId, deletedAt: null },
    include: {
      item: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(
    items.map((inv: (typeof items)[number]) => ({
      id: inv.id,
      itemId: inv.itemId,
      itemName: inv.item.name,
      quantityOnHand: inv.quantityOnHand,
      lowStockThreshold: inv.lowStockThreshold ?? null,
      trackingEnabled: inv.trackingEnabled,
      updatedAt: inv.updatedAt.toISOString(),
    })),
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    churchId?: string;
    name?: string;
    quantity?: number;
    lowStockThreshold?: number | null;
  } | null;

  if (!body?.churchId || !body?.name) {
    return NextResponse.json({ error: "Missing required fields: churchId, name" }, { status: 400 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === body.churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("inventory.adjust", {
    userId: session.user.id,
    churchId: body.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quantity = typeof body.quantity === "number" && body.quantity >= 0 ? body.quantity : 0;

  // Create the Item record, then link an InventoryItem to it
  const item = await db.item.create({
    data: {
      churchId: body.churchId,
      name: body.name.trim(),
      defaultPrice: 0,
    },
  });

  const inventoryItem = await db.inventoryItem.create({
    data: {
      churchId: body.churchId,
      itemId: item.id,
      quantityOnHand: quantity,
      lowStockThreshold: typeof body.lowStockThreshold === "number" ? body.lowStockThreshold : null,
    },
    include: {
      item: { select: { name: true } },
    },
  });

  return NextResponse.json(
    {
      id: inventoryItem.id,
      itemId: inventoryItem.itemId,
      itemName: inventoryItem.item.name,
      quantityOnHand: inventoryItem.quantityOnHand,
      lowStockThreshold: inventoryItem.lowStockThreshold ?? null,
      trackingEnabled: inventoryItem.trackingEnabled,
      updatedAt: inventoryItem.updatedAt.toISOString(),
    },
    { status: 201 },
  );
}
