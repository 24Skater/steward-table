import { db } from "@/lib/db";
import { getStripeForChurch } from "@/lib/stripe/client";

/**
 * Auto-refund side effect handler.
 * Called when an order transitions to CANCELED or REFUNDED via the state machine
 * (e.g., customer self-cancel, no-show sweep). Only issues a Stripe refund if:
 * - There is a captured Stripe payment on the order
 * - The refund hasn't already been issued
 */
export async function handleStripeRefundEffect(orderId: string): Promise<void> {
  try {
    const order = await (db.order.findUnique as PrismaBypass)({
      where: { id: orderId },
      select: {
        id: true,
        churchId: true,
        total: true,
        payments: {
          where: { status: "CAPTURED" },
          select: { id: true, method: true, amount: true, externalId: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        refunds: {
          where: { status: "COMPLETED" },
          select: { id: true, amount: true },
        },
      },
      _bypassTenancyCheck: true,
    }) as {
      id: string;
      churchId: string;
      total: number;
      payments: Array<{ id: string; method: string; amount: number; externalId: string | null }>;
      refunds: Array<{ id: string; amount: number }>;
    } | null;

    if (!order) return;

    const capturedPayment = order.payments[0];
    if (!capturedPayment) return;

    const isStripePayment =
      capturedPayment.method === "STRIPE_CARD" ||
      capturedPayment.method === "STRIPE_OTHER";
    if (!isStripePayment || !capturedPayment.externalId) return;

    // Skip if a full refund has already been issued
    const alreadyRefunded = order.refunds.reduce((sum, r) => sum + r.amount, 0);
    if (alreadyRefunded >= capturedPayment.amount) return;

    const stripe = await getStripeForChurch(order.churchId);
    if (!stripe) return;

    const refundAmount = capturedPayment.amount - alreadyRefunded;

    const stripeRefund = await stripe.refunds.create({
      payment_intent: capturedPayment.externalId,
      amount: refundAmount,
    });

    await db.$transaction(async (tx) => {
      await tx.refund.create({
        data: {
          orderId,
          paymentId: capturedPayment.id,
          amount: refundAmount,
          reason: "Order canceled — automatic refund",
          status: "COMPLETED",
          externalId: stripeRefund.id,
        },
      });

      await tx.payment.update({
        where: { id: capturedPayment.id },
        data: { status: "REFUNDED" },
      });
    });
  } catch (err) {
    console.error("[stripe-refund] auto-refund failed", { orderId, err });
  }
}
