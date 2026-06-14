import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { effectQueue } from "@/lib/orders/effect-queue";
import { transition } from "@/lib/orders/transitions";
import { can } from "@/lib/rbac/can";
import { getStripeForChurch } from "@/lib/stripe/client";
import { type NextRequest, NextResponse } from "next/server";

interface RefundBody {
  reason?: string;
  refundAll?: boolean;
  amountCents?: number;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const activeMembership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!activeMembership) {
    return NextResponse.json({ error: "No active membership" }, { status: 403 });
  }

  const { churchId } = activeMembership;
  const { orderId } = await params;

  const canResult = await can("order.refund", {
    userId: session.user.id,
    churchId,
    roles: activeMembership.roles,
  });
  if (!canResult.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { reason, refundAll, amountCents } = body as RefundBody;

  // Fetch the order with its payments, scoped to this church
  const order = (await (db.order.findFirst as PrismaBypass)({
    where: { id: orderId, churchId },
    include: {
      payments: {
        where: { status: "CAPTURED" },
        orderBy: { createdAt: "desc" },
      },
    },
    _bypassTenancyCheck: true,
  })) as {
    id: string;
    churchId: string;
    status: string;
    total: number;
    payments: Array<{
      id: string;
      method: string;
      status: string;
      amount: number;
      externalId: string | null;
    }>;
  } | null;

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "COMPLETED") {
    return NextResponse.json({ error: "Only COMPLETED orders can be refunded" }, { status: 422 });
  }

  // Determine refund amount
  const capturedPayment = order.payments[0] ?? null;
  const totalCaptured = capturedPayment?.amount ?? order.total;
  const resolvedAmount = refundAll ? totalCaptured : (amountCents ?? totalCaptured);

  if (resolvedAmount <= 0) {
    return NextResponse.json({ error: "Refund amount must be positive" }, { status: 400 });
  }
  if (resolvedAmount > totalCaptured) {
    return NextResponse.json({ error: "Refund amount exceeds captured payment" }, { status: 422 });
  }

  // Enforce STAFF refund cap — ADMIN/OWNER are exempt
  const isAdminOrOwner = activeMembership.roles.some((r) => r === "ADMIN" || r === "OWNER");
  if (!isAdminOrOwner) {
    const settings = await (db.churchSettings.findUnique as PrismaBypass)({
      where: { churchId },
      select: { staffRefundCapCents: true },
      _bypassTenancyCheck: true,
    });
    const cap: number = settings?.staffRefundCapCents ?? 5000;
    if (cap > 0 && resolvedAmount > cap) {
      return NextResponse.json(
        {
          error: `Staff refunds are limited to $${(cap / 100).toFixed(2)}. Contact an admin for larger refunds.`,
        },
        { status: 403 },
      );
    }
  }

  const isStripePayment =
    capturedPayment?.method === "STRIPE_CARD" || capturedPayment?.method === "STRIPE_OTHER";

  let stripeRefundId: string | undefined;

  if (isStripePayment && capturedPayment?.externalId) {
    const stripe = await getStripeForChurch(churchId);
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured for this church" },
        { status: 422 },
      );
    }

    try {
      const stripeRefund = await stripe.refunds.create({
        payment_intent: capturedPayment.externalId,
        amount: resolvedAmount,
      });
      stripeRefundId = stripeRefund.id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Stripe refund failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const isPartial = resolvedAmount < totalCaptured;

  // Persist refund record + update payment status in a transaction
  const refund = await db.$transaction(async (tx) => {
    const created = await tx.refund.create({
      data: {
        orderId,
        paymentId: capturedPayment?.id ?? null,
        amount: resolvedAmount,
        reason: reason ?? "Refund",
        status: "COMPLETED",
        actorId: session.user.id,
        externalId: stripeRefundId ?? null,
      },
    });

    if (capturedPayment) {
      await tx.payment.update({
        where: { id: capturedPayment.id },
        data: {
          status: isPartial ? "PARTIALLY_REFUNDED" : "REFUNDED",
        },
      });
    }

    return created;
  });

  // Transition order status to REFUNDED for full refunds only
  if (!isPartial) {
    try {
      await transition(orderId, "REFUNDED", {
        actorId: session.user.id,
        reason: reason ?? "Refund issued",
        queue: effectQueue,
      });
    } catch {
      // Transition failure is non-fatal at this point — refund has already been recorded
    }
  }

  return NextResponse.json({ success: true, refundId: refund.id });
}
