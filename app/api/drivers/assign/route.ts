import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";

// NOTE on schema:
// `driverId` lives on DeliveryInfo (delivery.prisma), not on Order.
// This route updates DeliveryInfo.driverId via a nested upsert on the order.
// If DeliveryInfo does not exist for the order, the assignment is rejected
// because there is no delivery address to deliver to.

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    !("orderId" in body) ||
    typeof (body as Record<string, unknown>).orderId !== "string"
  ) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const { orderId, driverId } = body as {
    orderId: string;
    driverId?: string | null;
  };

  const order = await (db.order.findUnique as PrismaBypass)({
    where: { id: orderId },
    select: {
      id: true,
      churchId: true,
      fulfillment: true,
      deliveryInfo: { select: { id: true } },
    },
    _bypassTenancyCheck: true,
  }) as {
    id: string;
    churchId: string;
    fulfillment: string;
    deliveryInfo: { id: string } | null;
  } | null;

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (order.fulfillment !== "DELIVERY") {
    return NextResponse.json(
      { error: "Order is not a delivery order" },
      { status: 422 },
    );
  }

  if (!order.deliveryInfo) {
    return NextResponse.json(
      { error: "Order has no delivery info; cannot assign a driver" },
      { status: 422 },
    );
  }

  const membership = session.user.memberships?.find(
    (m) => m.churchId === order.churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Assigning a driver to an order requires order.update (STAFF / ADMIN / OWNER).
  // DRIVER role uses order.deliver for their own deliveries; they cannot
  // reassign drivers to other orders.
  const result = await can("order.update", {
    userId: session.user.id,
    churchId: order.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // If assigning to a specific driver, verify that driver is an active DRIVER
  // member of this church.
  if (driverId) {
    const driverMembership = await (db.membership.findFirst as PrismaBypass)({
      where: {
        userId: driverId,
        churchId: order.churchId,
        status: "ACTIVE",
      },
      select: { id: true, roles: true },
      _bypassTenancyCheck: true,
    }) as { id: string; roles: string[] } | null;

    if (!driverMembership) {
      return NextResponse.json(
        { error: "Driver is not an active member of this church" },
        { status: 422 },
      );
    }

    if (!driverMembership.roles.includes("DRIVER")) {
      return NextResponse.json(
        { error: "User does not have the Driver role" },
        { status: 422 },
      );
    }
  }

  await (db.deliveryInfo.update as PrismaBypass)({
    where: { id: order.deliveryInfo.id },
    data: { driverId: driverId ?? null },
    _bypassTenancyCheck: true,
  });

  return NextResponse.json({ success: true });
}
