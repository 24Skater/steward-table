import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { effectQueue } from "@/lib/orders/effect-queue";
import { transition } from "@/lib/orders/transitions";
import { can } from "@/lib/rbac/can";
import type { OrderStatus } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

const VALID_ORDER_STATUSES = new Set<string>([
  "DRAFT",
  "SUBMITTED",
  "CONFIRMED",
  "IN_KITCHEN",
  "READY",
  "AWAITING_PICKUP",
  "OUT_FOR_DELIVERY",
  "PICKED_UP",
  "DELIVERED",
  "SERVED",
  "COMPLETED",
  "CANCELED",
  "REFUNDED",
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    !("orderIds" in body) ||
    !("targetStatus" in body) ||
    !Array.isArray((body as Record<string, unknown>).orderIds) ||
    typeof (body as Record<string, unknown>).targetStatus !== "string"
  ) {
    return NextResponse.json(
      { error: "Body must include orderIds (string[]) and targetStatus (string)" },
      { status: 400 },
    );
  }

  const { orderIds, targetStatus } = body as {
    orderIds: unknown[];
    targetStatus: string;
  };

  if (!VALID_ORDER_STATUSES.has(targetStatus)) {
    return NextResponse.json({ error: "Invalid targetStatus" }, { status: 400 });
  }

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "orderIds must be a non-empty array" }, { status: 400 });
  }

  const ids = orderIds.filter((id): id is string => typeof id === "string");
  if (ids.length === 0) {
    return NextResponse.json({ error: "orderIds must contain strings" }, { status: 400 });
  }

  // Determine which church the user is active in
  const activeMembership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!activeMembership) {
    return NextResponse.json({ error: "No active membership" }, { status: 403 });
  }

  const { churchId } = activeMembership;

  const result = await can("order.update", {
    userId: session.user.id,
    churchId,
    roles: activeMembership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify all requested orders belong to this church (security check)
  const ownedOrders = await (db.order.findMany as Function)({
    where: {
      id: { in: ids },
      churchId,
    },
    select: { id: true, status: true },
    _bypassTenancyCheck: true,
  }) as Array<{ id: string; status: OrderStatus }>;

  const ownedIds = new Set(ownedOrders.map((o) => o.id));

  let updated = 0;
  let failed = 0;

  for (const orderId of ids) {
    if (!ownedIds.has(orderId)) {
      failed++;
      continue;
    }
    try {
      await transition(orderId, targetStatus as OrderStatus, {
        actorId: session.user.id,
        queue: effectQueue,
      });
      updated++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ updated, failed });
}
