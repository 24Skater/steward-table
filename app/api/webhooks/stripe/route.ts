import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripeForChurch, getStripeWebhookSecret } from "@/lib/stripe/client";
import { transition } from "@/lib/orders/transitions";
import { effectQueue } from "@/lib/orders/effect-queue";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // The churchId comes from the Stripe session metadata, so we need to parse
  // the payload first (unverified) to find the right webhook secret.
  let rawEvent: { type: string; data: { object: Record<string, unknown> } };
  try {
    rawEvent = JSON.parse(body) as typeof rawEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const session = rawEvent.data.object as {
    metadata?: { orderId?: string; churchId?: string };
    payment_intent?: string;
    amount_total?: number;
    currency?: string;
  };

  const churchId = session.metadata?.churchId;
  const orderId = session.metadata?.orderId;

  if (!churchId || !orderId) {
    // Not a Steward Table event — ignore silently
    return NextResponse.json({ received: true });
  }

  // Verify signature using the church's per-endpoint webhook secret
  const webhookSecret = await getStripeWebhookSecret(churchId);
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 422 });
  }

  const stripe = await getStripeForChurch(churchId);
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 422 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, orderId, churchId);
        break;

      case "checkout.session.expired":
        await handleCheckoutExpired(orderId);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent, orderId);
        break;

      default:
        // Unhandled event type — log to webhook_events for audit
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error", { eventType: event.type, orderId, err });
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  // Persist webhook event for audit log
  await (db.webhookEvent.create as PrismaBypass)({
    data: {
      churchId,
      provider: "stripe",
      eventId: event.id,
      eventType: event.type,
      payload: event as unknown as Record<string, unknown>,
      signatureValid: true,
      processedAt: new Date(),
    },
    _bypassTenancyCheck: true,
  }).catch(() => null);

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  orderId: string,
  churchId: string,
): Promise<void> {
  const order = await (db.order.findUnique as PrismaBypass)({
    where: { id: orderId },
    select: { id: true, status: true, payments: { select: { id: true, status: true } } },
    _bypassTenancyCheck: true,
  }) as { id: string; status: string; payments: Array<{ id: string; status: string }> } | null;

  if (!order) return;

  // Mark payment as captured
  const pendingPayment = order.payments.find((p) => p.status === "PENDING");
  if (pendingPayment) {
    await db.payment.update({
      where: { id: pendingPayment.id },
      data: {
        status: "CAPTURED",
        externalId: session.payment_intent as string | null,
        amount: session.amount_total ?? 0,
        currency: (session.currency?.toUpperCase()) ?? "USD",
      },
    });
  }

  // For Stripe orders: payment capture = automatic confirmation
  if (order.status === "DRAFT") {
    await transition(orderId, "SUBMITTED", {
      actorId: "stripe-webhook",
      reason: "Payment captured via Stripe",
      queue: effectQueue,
    });
  }

  if (order.status === "DRAFT" || order.status === "SUBMITTED") {
    await transition(orderId, "CONFIRMED", {
      actorId: "stripe-webhook",
      reason: "Payment captured via Stripe",
      queue: effectQueue,
    });
  }
}

async function handleCheckoutExpired(orderId: string): Promise<void> {
  const order = await (db.order.findUnique as PrismaBypass)({
    where: { id: orderId },
    select: { id: true, status: true },
    _bypassTenancyCheck: true,
  }) as { id: string; status: string } | null;

  if (!order || order.status !== "DRAFT") return;

  await transition(orderId, "CANCELED", {
    actorId: "stripe-webhook",
    reason: "Stripe checkout session expired",
    queue: effectQueue,
  }).catch(() => null);
}

async function handlePaymentFailed(
  _paymentIntent: Stripe.PaymentIntent,
  orderId: string,
): Promise<void> {
  const order = await (db.order.findUnique as PrismaBypass)({
    where: { id: orderId },
    select: { id: true, status: true },
    _bypassTenancyCheck: true,
  }) as { id: string; status: string } | null;

  if (!order || order.status !== "DRAFT") return;

  // Leave the order in DRAFT — the customer can retry via a new Stripe session.
  // Update the payment record status.
  await db.payment.updateMany({
    where: { orderId, status: "PENDING" },
    data: { status: "FAILED" },
  });
}
