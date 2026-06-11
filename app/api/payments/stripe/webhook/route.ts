import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getPaymentAdapter } from "@/lib/payments";
import { transition } from "@/lib/orders/transitions";

// Raw body access requires the Node.js runtime
export const runtime = "nodejs";

interface StripeEventPayload {
  type?: string;
  data?: {
    object?: {
      metadata?: {
        churchId?: string;
        orderId?: string;
      };
    };
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let payload: StripeEventPayload;
  try {
    payload = JSON.parse(rawBody) as StripeEventPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const churchId = payload?.data?.object?.metadata?.churchId;
  if (!churchId) {
    // Events without churchId in metadata cannot be routed — acknowledge to avoid Stripe retries
    return NextResponse.json({ received: true });
  }

  const adapter = getPaymentAdapter("BYO");

  let event: Stripe.Event;
  try {
    event = await adapter.constructWebhookEvent(rawBody, signature, churchId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;

    if (orderId) {
      try {
        // SUBMITTED -> CONFIRMED is the valid post-payment transition
        await transition(orderId, "CONFIRMED", {
          actorId: "stripe-webhook",
          reason: `Stripe checkout session ${session.id} completed`,
          metadata: { stripeSessionId: session.id },
        });
      } catch {
        // Transition may throw InvalidTransitionError if already confirmed — safe to ignore
      }
    }
  }

  return NextResponse.json({ received: true });
}
