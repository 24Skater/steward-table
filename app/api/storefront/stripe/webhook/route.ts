import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripeForChurch, getStripeWebhookSecret } from "@/lib/stripe/client";
import { transition } from "@/lib/orders/transitions";
import { effectQueue } from "@/lib/orders/effect-queue";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await req.arrayBuffer();
  const body = Buffer.from(rawBody);

  // Extract churchId from the event metadata to load the correct keys.
  // We do a preliminary JSON parse only to route to the right church —
  // signature verification happens right after with the raw body.
  let preliminaryChurchId: string | undefined;
  try {
    const preliminary = JSON.parse(body.toString("utf8")) as {
      data?: { object?: { metadata?: { churchId?: string } } };
    };
    preliminaryChurchId = preliminary.data?.object?.metadata?.churchId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!preliminaryChurchId) {
    return NextResponse.json(
      { error: "churchId not found in event metadata" },
      { status: 400 },
    );
  }

  const webhookSecret = await getStripeWebhookSecret(preliminaryChurchId);
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured for church" },
      { status: 503 },
    );
  }

  const stripe = await getStripeForChurch(preliminaryChurchId);
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe not configured for church" },
      { status: 503 },
    );
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId in metadata" }, { status: 400 });
    }

    // Transition DRAFT -> SUBMITTED (triggers confirmation side effects)
    await transition(orderId, "SUBMITTED", {
      reason: "stripe_payment_completed",
      metadata: { stripeSessionId: session.id },
      queue: effectQueue,
    });

    // Update the pending Payment record to CAPTURED
    await db.payment.updateMany({
      where: {
        order: { id: orderId },
        method: "STRIPE_CARD",
        status: "PENDING",
      },
      data: {
        status: "CAPTURED",
        externalId: session.id,
      },
    });
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;

    if (orderId) {
      // Cancel the DRAFT order if it hasn't moved forward
      const order = await (db.order.findUnique as Function)({
        where: { id: orderId },
        select: { status: true },
        _bypassTenancyCheck: true,
      });

      if (order?.status === "DRAFT") {
        await transition(orderId, "CANCELED", {
          reason: "stripe_session_expired",
          metadata: { stripeSessionId: session.id },
          queue: effectQueue,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
