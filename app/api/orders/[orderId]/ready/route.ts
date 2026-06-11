import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac/can";
import { transition } from "@/lib/orders/transitions";
import { db } from "@/lib/db";
import { sendOrderNotification } from "@/lib/notifications";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { orderId } = await params;

  // Fetch order to get churchId
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, churchId: true, status: true },
    // @ts-expect-error bypass tenancy for system read
    _bypassTenancyCheck: true,
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Get caller's roles for this church
  const membership = session.user.memberships?.find(
    (m: { churchId: string; status: string; roles: string[] }) =>
      m.churchId === order.churchId && m.status === "ACTIVE",
  );

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const permitted = await can("order.kitchen", {
    userId: session.user.id,
    churchId: order.churchId,
    roles: membership.roles,
  });

  if (!permitted.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await transition(orderId, "READY", { actorId: session.user.id });
    void sendOrderNotification(orderId, "READY");
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Invalid order transition")) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
