import type { FulfillmentType, OrderStatus } from "@prisma/client";

export interface NextStep {
  label: string;
  targetStatus: OrderStatus;
}

export function getNextStep(status: OrderStatus, fulfillment: FulfillmentType): NextStep | null {
  switch (status) {
    case "SUBMITTED":
      return { label: "Confirm", targetStatus: "CONFIRMED" };
    case "CONFIRMED":
      return { label: "Send to kitchen", targetStatus: "IN_KITCHEN" };
    case "IN_KITCHEN":
      return { label: "Mark ready", targetStatus: "READY" };
    case "READY":
      if (fulfillment === "DELIVERY") {
        return { label: "Send for delivery", targetStatus: "OUT_FOR_DELIVERY" };
      }
      if (fulfillment === "DINE_IN") {
        return { label: "Mark served", targetStatus: "SERVED" };
      }
      // PICKUP default
      return { label: "Awaiting pickup", targetStatus: "AWAITING_PICKUP" };
    case "AWAITING_PICKUP":
      return { label: "Mark picked up", targetStatus: "PICKED_UP" };
    case "PICKED_UP":
      return { label: "Complete", targetStatus: "COMPLETED" };
    case "OUT_FOR_DELIVERY":
      return { label: "Mark delivered", targetStatus: "DELIVERED" };
    case "DELIVERED":
      return { label: "Complete", targetStatus: "COMPLETED" };
    case "SERVED":
      return { label: "Complete", targetStatus: "COMPLETED" };
    default:
      return null;
  }
}

export const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  PICKUP: "Pickup",
  DELIVERY: "Delivery",
  DINE_IN: "Dine-in",
};

export function formatOrderTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
