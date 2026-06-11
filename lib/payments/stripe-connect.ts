import type Stripe from "stripe";
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

// TODO: Implement Stripe Connect adapter for hosted deployments
// In Connect mode, Steward Table is the platform — churches are connected accounts
export class StripeConnectAdapter implements PaymentAdapter {
  async createCheckoutSession(_params: CreateCheckoutSessionParams): Promise<CheckoutSession> {
    throw new Error("TODO: implement Stripe Connect createCheckoutSession");
  }

  async createPaymentIntent(_params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    throw new Error("TODO: implement Stripe Connect createPaymentIntent");
  }

  async capturePayment(_params: CapturePaymentParams): Promise<CaptureResult> {
    throw new Error("TODO: implement Stripe Connect capturePayment");
  }

  async refund(_params: RefundParams): Promise<RefundResult> {
    throw new Error("TODO: implement Stripe Connect refund");
  }

  async constructWebhookEvent(
    _payload: string | Buffer,
    _signature: string,
    _churchId: string,
  ): Promise<Stripe.Event> {
    throw new Error("TODO: implement Stripe Connect constructWebhookEvent");
  }
}
