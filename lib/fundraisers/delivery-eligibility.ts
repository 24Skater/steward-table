/**
 * Per-fundraiser delivery eligibility: an order must contain at least
 * `minItemsForDelivery` items (sum of quantities) to qualify for delivery.
 * null/undefined/<=0 means no rule.
 */
export function isDeliveryEligible(
  totalItemCount: number,
  minItemsForDelivery: number | null | undefined,
): boolean {
  if (!minItemsForDelivery || minItemsForDelivery <= 0) return true;
  return totalItemCount >= minItemsForDelivery;
}
