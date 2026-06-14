import { db } from "@/lib/db";
import { handleInventoryEffect } from "@/lib/inventory/handler";
import { sendOrderNotification, sendStaffNewOrderEmail } from "@/lib/notifications/email";
import { handleSmsEffect } from "@/lib/notifications/sms";
import { handleStripeRefundEffect } from "@/lib/payments/stripe-refund";
import type { OrderStatus } from "@prisma/client";
import type { SideEffect, SideEffectQueue } from "./transitions";

const EMAIL_STATUS_MAP: Partial<Record<string, OrderStatus>> = {
  "email.order_confirmation": "SUBMITTED",
  "email.order_canceled": "CANCELED",
  "email.order_ready": "READY",
};

async function dispatch(effect: SideEffect): Promise<void> {
  try {
    if (effect.kind.startsWith("inventory.")) {
      await handleInventoryEffect(effect);
      return;
    }

    if (effect.kind.startsWith("sms.")) {
      await handleSmsEffect(effect);
      return;
    }

    if (effect.kind.startsWith("email.")) {
      const status = EMAIL_STATUS_MAP[effect.kind];
      if (status) {
        await sendOrderNotification(effect.orderId, status);
      }
      return;
    }

    if (effect.kind === "notify.staff_new_order") {
      await sendStaffNewOrderEmail(effect.orderId);
      return;
    }

    if (effect.kind === "stripe.refund") {
      await handleStripeRefundEffect(effect.orderId);
      return;
    }

    if (effect.kind === "notify.customer_order_status") {
      await handleCustomerStatusNotification(effect.orderId);
      return;
    }
    // reporting.* — log and skip for now
  } catch (err) {
    console.error("[effect-queue] dispatch failed", {
      kind: effect.kind,
      orderId: effect.orderId,
      err,
    });
  }
}

export const effectQueue: SideEffectQueue = {
  async enqueue(effect: SideEffect): Promise<void> {
    void dispatch(effect);
  },
};

const STATUS_NOTIFICATION_BODY: Partial<Record<string, string>> = {
  CONFIRMED: "Your order has been confirmed.",
  READY: "Your order is ready for pickup!",
  OUT_FOR_DELIVERY: "Your order is out for delivery.",
  CANCELED: "Your order has been canceled.",
};

async function handleCustomerStatusNotification(orderId: string): Promise<void> {
  const order = (await (db.order.findUnique as PrismaBypass)({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      status: true,
      churchId: true,
      customer: { select: { userId: true } },
    },
    _bypassTenancyCheck: true,
  })) as {
    id: string;
    number: number;
    status: string;
    churchId: string;
    customer: { userId: string | null } | null;
  } | null;

  const userId = order?.customer?.userId;
  if (!userId || !order) return;

  const body = STATUS_NOTIFICATION_BODY[order.status];
  if (!body) return;

  await db.notification.create({
    data: {
      churchId: order.churchId,
      userId,
      type: "order_status",
      body: `Order #${order.number}: ${body}`,
      link: `/order/${order.id}`,
    },
  });
}
