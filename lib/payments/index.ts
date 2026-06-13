import type { PaymentAdapter } from "./adapter";
import { StripeBYOAdapter } from "./stripe-byo";
import { StripeConnectAdapter } from "./stripe-connect";

// Mirror the Prisma enum values without importing from @prisma/client
// so this module works even before `prisma generate` has run.
type StripeMode = "BYO" | "CONNECT";

const adapterCache = new Map<string, PaymentAdapter>();

/**
 * Returns the correct PaymentAdapter for a church based on their StripeMode setting.
 * BYO is the default — churches paste their own Stripe keys.
 * Connect is an opt-in mode for hosted Steward Table deployments.
 */
export function getPaymentAdapter(stripeMode: StripeMode = "BYO"): PaymentAdapter {
  const cacheKey = stripeMode;

  const cached = adapterCache.get(cacheKey);
  if (cached) return cached;

  let adapter: PaymentAdapter;

  switch (stripeMode) {
    case "BYO":
      adapter = new StripeBYOAdapter();
      break;
    case "CONNECT":
      adapter = new StripeConnectAdapter();
      break;
    default:
      adapter = new StripeBYOAdapter();
  }

  adapterCache.set(cacheKey, adapter);
  return adapter;
}

export type { PaymentAdapter } from "./adapter";
export { StripeBYOAdapter } from "./stripe-byo";
export { StripeConnectAdapter } from "./stripe-connect";
