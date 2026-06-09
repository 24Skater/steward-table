import { NextRequest, NextResponse } from "next/server";

// Disable body parsing — Stripe needs the raw body to verify the signature
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // TODO: Verify Stripe webhook signature using STRIPE_WEBHOOK_SECRET
  // TODO: Handle payment_intent.succeeded, payment_intent.payment_failed
  // TODO: Call transition() for SUBMITTED -> CONFIRMED on payment success
  return NextResponse.json({ received: true });
}
