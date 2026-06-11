import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { transition, InvalidTransitionError } from "@/lib/orders/transitions";
import { can } from "@/lib/rbac/can";
import { db } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { orderId } = await params;

  const body: unknown = await req.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    !("status" in body) ||
    typeof (body as Record<string, unknown>).status !== "string"
  ) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const targetStatus = (body as Record<string, string>).status as OrderStatus;

  // System-level read to get churchId — auth check has already happened above
  const order = await (db.order.findUnique as Function)({
    where: { id: orderId },
    select: { id: true, churchId: true, status: true },
    _bypassTenancyCheck: true,
  }) as { id: string; churchId: string; status: OrderStatus } | null;

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = session.user.memberships?.find(
    (m) => m.churchId === order.churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("order.update", {
    userId: session.user.id,
    churchId: order.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await transition(orderId, targetStatus, { actorId: session.user.id });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof Error && err.message.includes("Invalid")) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
