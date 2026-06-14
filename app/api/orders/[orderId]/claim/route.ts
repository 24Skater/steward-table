import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { orderId } = await params;

  const order = (await (db.order.findUnique as PrismaBypass)({
    where: { id: orderId },
    select: {
      id: true,
      churchId: true,
      status: true,
      fulfillment: true,
      deliveryInfo: { select: { id: true, driverId: true } },
    },
    _bypassTenancyCheck: true,
  })) as {
    id: string;
    churchId: string;
    status: string;
    fulfillment: string;
    deliveryInfo: { id: string; driverId: string | null } | null;
  } | null;

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (order.fulfillment !== "DELIVERY") {
    return NextResponse.json({ error: "Order is not a delivery order" }, { status: 400 });
  }

  if (order.status !== "READY") {
    return NextResponse.json({ error: "Order is not ready for pickup" }, { status: 409 });
  }

  if (!order.deliveryInfo) {
    return NextResponse.json({ error: "No delivery info on order" }, { status: 422 });
  }

  const membership = session.user.memberships?.find(
    (m) => m.churchId === order.churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("order.deliver", {
    userId: session.user.id,
    churchId: order.churchId,
    roles: membership.roles,
  });

  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Optimistic lock: only claim if still unassigned
  const updated = await (db.deliveryInfo.updateMany as PrismaBypass)({
    where: {
      id: order.deliveryInfo.id,
      driverId: null,
    },
    data: { driverId: session.user.id },
    _bypassTenancyCheck: true,
  }) as { count: number };

  if (updated.count === 0) {
    return NextResponse.json(
      { error: "Order was already claimed by another driver" },
      { status: 409 },
    );
  }

  // Redirect for form-based submissions
  const contentType = _req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    return new NextResponse(null, { status: 303, headers: { Location: "/d" } });
  }

  return NextResponse.json({ success: true });
}
