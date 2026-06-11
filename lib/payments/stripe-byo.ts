import Stripe from "stripe";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto/aes";
import type {
  CapturePaymentParams,
  CaptureResult,
  CheckoutSession,
  CreateCheckoutSessionParams,
  CreatePaymentIntentParams,
  PaymentAdapter,
  PaymentIntentResult,
  RefundParams,
  RefundResult,
} from "./adapter";

const STRIPE_API_VERSION = "2025-02-24.acacia" as const;

async function getStripeClientForChurch(churchId: string): Promise<Stripe> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiKey = await (db.apiKey.findFirst as any)({
    where: { churchId, provider: "stripe", isLive: true },
    select: { encrypted: true },
    _bypassTenancyCheck: true,
  });

  if (!apiKey?.encrypted) {
    throw new Error(`[Stripe] No Stripe key configured for church ${churchId}`);
  }

  const secretKey = decrypt(apiKey.encrypted as Buffer);

  return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
}

export class StripeBYOAdapter implements PaymentAdapter {
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession> {
    const stripe = await getStripeClientForChurch(params.churchId);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: params.lineItems.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: item.unitAmount,
        },
        quantity: item.quantity,
      })),
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        orderId: params.orderId,
        churchId: params.churchId,
      },
    });

    return {
      id: session.id,
      url: session.url ?? "",
      expiresAt: new Date(session.expires_at * 1000),
    };
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    const stripe = await getStripeClientForChurch(params.churchId);

    const intent = await stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      metadata: {
        orderId: params.orderId,
        churchId: params.churchId,
        ...(params.metadata ?? {}),
      },
      capture_method: "automatic",
    });

    return {
      id: intent.id,
      clientSecret: intent.client_secret ?? "",
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency,
    };
  }

  async capturePayment(params: CapturePaymentParams): Promise<CaptureResult> {
    const stripe = await getStripeClientForChurch(params.churchId);

    const intent = await stripe.paymentIntents.capture(params.paymentIntentId);

    return {
      id: intent.id,
      status: intent.status,
      amount: intent.amount_received,
    };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const stripe = await getStripeClientForChurch(params.churchId);

    const refund = await stripe.refunds.create(
      {
        payment_intent: params.paymentIntentId,
        amount: params.amount,
        reason: "requested_by_customer",
        metadata: { reason: params.reason },
      },
      { idempotencyKey: params.idempotencyKey },
    );

    return {
      id: refund.id,
      status: refund.status ?? "unknown",
      amount: refund.amount,
    };
  }

  async constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    churchId: string,
  ): Promise<Stripe.Event> {
    // Fetch both the Stripe secret key and webhook secret in parallel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findFirst = db.apiKey.findFirst as any;
    const [stripeKeyRow, webhookKeyRow] = await Promise.all([
      findFirst({
        where: { churchId, provider: "stripe", isLive: true },
        select: { encrypted: true },
        _bypassTenancyCheck: true,
      }),
      // Webhook secret is stored as a separate ApiKey row with provider "stripe_webhook"
      findFirst({
        where: { churchId, provider: "stripe_webhook", isLive: true },
        select: { encrypted: true },
        _bypassTenancyCheck: true,
      }),
    ]);

    if (!stripeKeyRow?.encrypted) {
      throw new Error(`[Stripe] No Stripe secret key configured for church ${churchId}`);
    }

    if (!webhookKeyRow?.encrypted) {
      throw new Error(`[Stripe] No webhook secret configured for church ${churchId}`);
    }

    const secretKey = decrypt(stripeKeyRow.encrypted as Buffer);
    const webhookSecret = decrypt(webhookKeyRow.encrypted as Buffer);

    const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
