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

// TODO: Implement Stripe Connect adapter for hosted deployments
// In Connect mode, Steward Table is the platform — churches are connected accounts
export class StripeConnectAdapter implements PaymentAdapter {
  async createPaymentIntent(
    _params: CreatePaymentIntentParams
  ): Promise<PaymentIntentResult> {
    throw new Error("TODO: implement Stripe Connect createPaymentIntent");
  }

  async capturePayment(_params: CapturePaymentParams): Promise<CaptureResult> {
    throw new Error("TODO: implement Stripe Connect capturePayment");
  }

  async refund(_params: RefundParams): Promise<RefundResult> {
    throw new Error("TODO: implement Stripe Connect refund");
  }

  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    throw new Error("TODO: implement Stripe Connect constructWebhookEvent");
  }
}
