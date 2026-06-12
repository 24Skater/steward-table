import { handleInventoryEffect } from "@/lib/inventory/handler";
import { sendOrderNotification, sendStaffNewOrderEmail } from "@/lib/notifications/email";
import { handleSmsEffect } from "@/lib/notifications/sms";
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
    // reporting.*, stripe.refund — log and skip for now
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
