import { db } from "@/lib/db";
import { isDeliveryEligible } from "@/lib/fundraisers/delivery-eligibility";
import { effectQueue } from "@/lib/orders/effect-queue";
import { transition } from "@/lib/orders/transitions";
import type { Channel, PaymentMethod } from "@prisma/client";

export interface CartModifierPayload {
  groupName: string;
  optionName: string;
  priceDelta: number;
}

export interface CartItemPayload {
  itemId: string;
  catalogId: string;
  itemName: string;
  quantity: number;
  basePrice: number;
  modifiers: CartModifierPayload[];
  totalPrice: number;
}

export interface DeliveryAddressPayload {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface CreateOrderParams {
  churchId: string;
  currency: string;
  customerName: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  fulfillment: "PICKUP" | "DELIVERY" | "DINE_IN";
  paymentMethod?: string;
  scheduledFor?: string | null;
  smsOptIn?: boolean;
  tip?: number;
  zoneId?: string | null;
  deliveryAddress?: DeliveryAddressPayload | null;
  items: CartItemPayload[];
  channel: Channel;
  takenById?: string | null;
  takenByName?: string | null;
  clientRequestId?: string | null;
  markPaidCash?: boolean;
}

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: number; deduplicated: boolean }
  | { ok: false; status: number; error: string };

export async function createStorefrontOrder(
  params: CreateOrderParams,
): Promise<CreateOrderResult> {
  // 1. Idempotency pre-check
  if (params.clientRequestId) {
    const existing = await db.order.findFirst({
      where: { churchId: params.churchId, clientRequestId: params.clientRequestId },
      select: { id: true, number: true },
    });
    if (existing) {
      return { ok: true, orderId: existing.id, orderNumber: existing.number, deduplicated: true };
    }
  }

  // 2. Catalog validation
  const firstCatalogId = params.items[0]?.catalogId;
  if (!firstCatalogId) {
    return { ok: false, status: 400, error: "Invalid items" };
  }

  const catalog = await db.catalog.findFirst({
    where: { id: firstCatalogId, churchId: params.churchId },
    select: { id: true, status: true, minItemsForDelivery: true },
  });

  if (!catalog) {
    return { ok: false, status: 400, error: "Invalid catalog" };
  }

  if (catalog.status !== "OPEN") {
    return { ok: false, status: 409, error: "This fundraiser has closed" };
  }

  // 3. Min-items check for DELIVERY
  if (params.fulfillment === "DELIVERY") {
    const totalItemCount = params.items.reduce((sum, item) => sum + item.quantity, 0);
    if (!isDeliveryEligible(totalItemCount, catalog.minItemsForDelivery)) {
      return {
        ok: false,
        status: 422,
        error: `Delivery requires at least ${catalog.minItemsForDelivery} items`,
      };
    }
  }

  // 4. Customer find-or-create (verbatim from storefront route)
  const phoneNormalized = params.phone?.replace(/\D/g, "") || null;
  const emailNormalized = params.email?.trim().toLowerCase() || null;

  let customerId: string;

  if (phoneNormalized) {
    const existing = await db.customer.findFirst({
      where: { churchId: params.churchId, phoneNormalized },
      select: { id: true },
    });

    if (existing) {
      customerId = existing.id;
      const updates: Record<string, unknown> = {};
      if (params.smsOptIn) updates.smsOptIn = true;
      if (emailNormalized) {
        updates.email = params.email?.trim();
        updates.emailNormalized = emailNormalized;
      }
      if (Object.keys(updates).length > 0) {
        await db.customer.update({ where: { id: existing.id }, data: updates });
      }
    } else {
      const created = await db.customer.create({
        data: {
          churchId: params.churchId,
          name: params.customerName.trim(),
          phone: params.phone ?? null,
          phoneNormalized,
          email: params.email?.trim() ?? null,
          emailNormalized,
          smsOptIn: params.smsOptIn ?? false,
        },
        select: { id: true },
      });
      customerId = created.id;
    }
  } else if (emailNormalized) {
    // No phone but email — try dedup by email
    const existing = await db.customer.findFirst({
      where: { churchId: params.churchId, emailNormalized },
      select: { id: true },
    });

    if (existing) {
      customerId = existing.id;
    } else {
      const created = await db.customer.create({
        data: {
          churchId: params.churchId,
          name: params.customerName.trim(),
          email: params.email?.trim(),
          emailNormalized,
        },
        select: { id: true },
      });
      customerId = created.id;
    }
  } else {
    // No phone, no email — create anonymous guest customer
    const created = await db.customer.create({
      data: {
        churchId: params.churchId,
        name: params.customerName.trim(),
      },
      select: { id: true },
    });
    customerId = created.id;
  }

  // 5. Get next order number atomically via upsert on OrderCounter
  const counter = await db.orderCounter.upsert({
    where: { churchId: params.churchId },
    create: { churchId: params.churchId, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  // 6. Totals and payment method resolution
  const subtotal = params.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const tipAmount = typeof params.tip === "number" && params.tip >= 0 ? Math.round(params.tip) : 0;
  const orderTotal = subtotal + tipAmount;

  const resolvedPaymentMethod: PaymentMethod =
    params.paymentMethod === "cash"
      ? "CASH"
      : params.paymentMethod === "zelle"
        ? "ZELLE"
        : "PAY_ON_PICKUP";

  // 7. Create order with items and payment
  let order: { id: string; number: number };

  try {
    order = await db.order.create({
      data: {
        churchId: params.churchId,
        catalogId: catalog.id,
        customerId,
        number: counter.value,
        channel: params.channel,
        fulfillment: params.fulfillment,
        status: "DRAFT",
        currency: params.currency,
        subtotal,
        tax: 0,
        tip: tipAmount,
        total: orderTotal,
        notes: params.notes ?? null,
        scheduledFor: params.scheduledFor ? new Date(params.scheduledFor) : null,
        takenById: params.takenById ?? null,
        takenByName: params.takenByName ?? null,
        clientRequestId: params.clientRequestId ?? null,
        receiptLanguageVersion: 1,
        items: {
          create: params.items.map((item) => {
            const unitPrice =
              item.basePrice + item.modifiers.reduce((s, m) => s + m.priceDelta, 0);
            const itemSubtotal = unitPrice * item.quantity;
            return {
              itemId: item.itemId,
              itemName: item.itemName,
              unitPrice,
              quantity: item.quantity,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              modifierSnapshot: item.modifiers as any,
              subtotal: itemSubtotal,
              tax: 0,
              total: itemSubtotal,
            };
          }),
        },
        payments: {
          create: {
            method: resolvedPaymentMethod,
            status: params.markPaidCash ? "CAPTURED" : "PENDING",
            amount: orderTotal,
            currency: params.currency,
          },
        },
      },
      select: { id: true, number: true },
    });
  } catch (err) {
    // 8. Unique-violation race on clientRequestId — re-fetch the winner
    if (params.clientRequestId) {
      const dedup = await db.order.findFirst({
        where: { churchId: params.churchId, clientRequestId: params.clientRequestId },
        select: { id: true, number: true },
      });
      if (dedup) {
        return { ok: true, orderId: dedup.id, orderNumber: dedup.number, deduplicated: true };
      }
    }
    throw err;
  }

  // 9. Create DeliveryInfo for delivery orders
  if (params.fulfillment === "DELIVERY" && params.deliveryAddress) {
    await db.deliveryInfo.create({
      data: {
        orderId: order.id,
        zoneId: params.zoneId ?? null,
        recipientName: params.customerName.trim(),
        phone: params.phone ?? "",
        line1: params.deliveryAddress.line1,
        city: params.deliveryAddress.city,
        region: params.deliveryAddress.region,
        postalCode: params.deliveryAddress.postalCode,
        country: params.deliveryAddress.country,
      },
    });
  }

  // 10. Transition DRAFT → SUBMITTED to fire side effects (email, SMS, inventory)
  await transition(order.id, "SUBMITTED", {
    actorId: params.takenById ?? "guest",
    queue: effectQueue,
  });

  // 11. Return success
  return { ok: true, orderId: order.id, orderNumber: order.number, deduplicated: false };
}
