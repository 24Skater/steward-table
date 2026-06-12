import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { effectQueue } from "@/lib/orders/effect-queue";
import { InvalidTransitionError, transition } from "@/lib/orders/transitions";
import { can } from "@/lib/rbac/can";
import type { OrderStatus } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

async function handleStatusChange(
  req: NextRequest,
  orderId: string,
  targetStatus: string,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const order = (await (db.order.findUnique as Function)({
    where: { id: orderId },
    select: { id: true, churchId: true, status: true },
    _bypassTenancyCheck: true,
  })) as { id: string; churchId: string; status: OrderStatus } | null;

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
    await transition(orderId, targetStatus as OrderStatus, {
      actorId: session.user.id,
      queue: effectQueue,
    });

    // Auto-advance terminal pickup/delivery states to COMPLETED
    const AUTO_COMPLETE: ReadonlySet<string> = new Set(["PICKED_UP", "DELIVERED", "SERVED"]);
    if (AUTO_COMPLETE.has(targetStatus)) {
      await transition(orderId, "COMPLETED", { queue: effectQueue });
    }

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const formData = await req.formData().catch(() => null);
  const targetStatus = formData?.get("status");
  if (typeof targetStatus !== "string") {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }
  const response = await handleStatusChange(req, orderId, targetStatus);
  if (response.status === 200) {
    return new NextResponse(null, {
      status: 303,
      headers: { Location: "/deliveries" },
    });
  }
  return response;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
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

  const targetStatus = (body as { status: string }).status;
  return handleStatusChange(req, orderId, targetStatus);
}
