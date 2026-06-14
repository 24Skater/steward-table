import { db } from "@/lib/db";
import type { SideEffect } from "@/lib/orders/transitions";
import { sendSms, smsOrderConfirmation, smsOrderReady, smsOutForDelivery } from "@/lib/sms";

export interface OrderWithCustomer {
  id: string;
  number: number;
  fulfillment: string;
  churchId: string;
  church: { name: string };
  customer: {
    phone: string | null;
    smsOptIn: boolean;
  };
}

async function fetchOrderWithCustomer(orderId: string): Promise<OrderWithCustomer | null> {
  return db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      fulfillment: true,
      churchId: true,
      church: { select: { name: true } },
      customer: { select: { phone: true, smsOptIn: true } },
    },
    // @ts-expect-error — bypass tenancy for notification reads
    _bypassTenancyCheck: true,
  }) as Promise<OrderWithCustomer | null>;
}

export async function handleSmsEffect(
  effect: SideEffect,
  order?: OrderWithCustomer,
): Promise<void> {
  const resolved = order ?? (await fetchOrderWithCustomer(effect.orderId));
  if (!resolved) return;

  const { customer, number, fulfillment, churchId, church } = resolved;

  // Skip if the customer has no phone or has not opted in
  if (!customer.phone) return;
  if (!customer.smsOptIn) return;

  let body: string;

  switch (effect.kind) {
    case "sms.order_confirmation":
      body = smsOrderConfirmation(number, church.name);
      break;

    case "sms.order_ready":
    case "sms.order_pickup_ready":
      body = smsOrderReady(number, fulfillment === "DELIVERY" ? "DELIVERY" : "PICKUP");
      break;

    case "sms.order_out_for_delivery":
      body = smsOutForDelivery(number);
      break;

    default:
      // Not an SMS effect — nothing to do
      return;
  }

  // SMS sending is best-effort — never throw, never block order flow
  await sendSms(customer.phone, body, churchId).catch(() => undefined);
}
