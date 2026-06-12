import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { effectQueue } from "@/lib/orders/effect-queue";
import { InvalidTransitionError, transition } from "@/lib/orders/transitions";
import { can } from "@/lib/rbac/can";
import type { OrderStatus } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

const DRIVER_ALLOWED_TARGETS = new Set<OrderStatus>(["OUT_FOR_DELIVERY", "DELIVERED"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { orderId } = await params;

  // Support both JSON body and form data
  let targetStatus: string | null = null;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await req.formData().catch(() => null);
    const val = formData?.get("status");
    if (typeof val === "string") targetStatus = val;
  } else {
    const body: unknown = await req.json().catch(() => null);
    if (body && typeof body === "object" && "status" in body && typeof (body as Record<string, unknown>).status === "string") {
      targetStatus = (body as { status: string }).status;
    }
  }

  if (!targetStatus) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  if (!DRIVER_ALLOWED_TARGETS.has(targetStatus as OrderStatus)) {
    return NextResponse.json(
      { error: "Drivers may only transition to OUT_FOR_DELIVERY or DELIVERED" },
      { status: 400 },
    );
  }

  const order = (await (db.order.findUnique as Function)({
    where: { id: orderId },
    select: {
      id: true,
      churchId: true,
      status: true,
      deliveryInfo: { select: { driverId: true } },
    },
    _bypassTenancyCheck: true,
  })) as {
    id: string;
    churchId: string;
    status: OrderStatus;
    deliveryInfo: { driverId: string | null } | null;
  } | null;

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = session.user.memberships?.find(
    (m) => m.churchId === order.churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const driverId = order.deliveryInfo?.driverId ?? null;

  const result = await can("order.deliver", {
    userId: session.user.id,
    churchId: order.churchId,
    roles: membership.roles,
    driverId: driverId ?? undefined,
  });

  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await transition(orderId, targetStatus as OrderStatus, {
      actorId: session.user.id,
      queue: effectQueue,
    });

    // If transitioning to DELIVERED, immediately advance to COMPLETED
    if (targetStatus === "DELIVERED") {
      await transition(orderId, "COMPLETED", { queue: effectQueue });
    }

    const isFormSubmit = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
    if (isFormSubmit) {
      return new NextResponse(null, { status: 303, headers: { Location: "/deliveries" } });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
