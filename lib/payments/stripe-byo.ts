import Stripe from "stripe";
import type {
  PaymentAdapter,
  CreatePaymentIntentParams,
  CapturePaymentParams,
  RefundParams,
  PaymentIntentResult,
  CaptureResult,
  RefundResult,
} from "./adapter";

// TODO: Replace with proper encryption/decryption using lib/crypto/
async function decryptApiKey(encrypted: Buffer): Promise<string> {
  // TODO: Implement AES-256-GCM decryption using ENCRYPTION_KEY env var
  throw new Error("TODO: implement decryptApiKey in lib/crypto/");
}

async function getStripeClientForChurch(churchId: string): Promise<Stripe> {
  // TODO: Look up church's ApiKey from DB, decrypt, return Stripe client
  // This is the BYO model — Steward Table never holds the keys in plaintext
  throw new Error(
    `TODO: getStripeClientForChurch(${churchId}) — fetch encrypted key from DB and decrypt`
  );
}

export class StripeBYOAdapter implements PaymentAdapter {
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
      { idempotencyKey: params.idempotencyKey }
    );

    return {
      id: refund.id,
      status: refund.status ?? "unknown",
      amount: refund.amount,
    };
  }

  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
      apiVersion: "2025-02-24.acacia",
    });

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
