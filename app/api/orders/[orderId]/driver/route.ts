import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { orderId } = await params;

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawDriverId = (body as Record<string, unknown>).driverId;
  if (rawDriverId !== null && rawDriverId !== undefined && typeof rawDriverId !== "string") {
    return NextResponse.json({ error: "driverId must be a string or null" }, { status: 400 });
  }
  const driverId = rawDriverId as string | null | undefined;

  // Fetch order to get churchId
  const order = (await (db.order.findUnique as Function)({
    where: { id: orderId },
    select: { id: true, churchId: true },
    _bypassTenancyCheck: true,
  })) as { id: string; churchId: string } | null;

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === order.churchId && m.status === "ACTIVE",
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

  // If assigning a driver, verify that user is a DRIVER-role member of this church
  if (driverId) {
    const driverMembership = (await (db.membership.findFirst as Function)({
      where: {
        churchId: order.churchId,
        status: "ACTIVE",
        roles: { has: "DRIVER" },
        user: { id: driverId },
      },
      select: { id: true },
      _bypassTenancyCheck: true,
    })) as { id: string } | null;

    if (!driverMembership) {
      return NextResponse.json(
        { error: "User is not an active DRIVER member of this church" },
        { status: 422 },
      );
    }
  }

  await (db.deliveryInfo.update as Function)({
    where: { orderId },
    data: { driverId: driverId ?? null },
  });

  return NextResponse.json({ success: true });
}
