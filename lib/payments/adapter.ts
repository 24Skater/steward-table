import type Stripe from "stripe";

export interface CreatePaymentIntentParams {
  amount: number; // minor units (cents)
  currency: string; // ISO 4217
  orderId: string;
  churchId: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

export interface CapturePaymentParams {
  paymentIntentId: string;
  churchId: string;
}

export interface RefundParams {
  paymentIntentId: string;
  amount?: number; // if undefined, full refund
  reason: string;
  churchId: string;
  idempotencyKey: string;
}

export interface PaymentIntentResult {
  id: string;
  clientSecret: string;
  status: string;
  amount: number;
  currency: string;
}

export interface CaptureResult {
  id: string;
  status: string;
  amount: number;
}

export interface RefundResult {
  id: string;
  status: string;
  amount: number;
}

/**
 * PaymentAdapter is the single interface all payment backends implement.
 * Steward Table never talks to Stripe directly — all payment operations go through this.
 */
export interface PaymentAdapter {
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult>;
  capturePayment(params: CapturePaymentParams): Promise<CaptureResult>;
  refund(params: RefundParams): Promise<RefundResult>;
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event;
}
