import { type NextRequest, NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { effectQueue } from "@/lib/orders/effect-queue";
import { transition } from "@/lib/orders/transitions";

interface CartModifierPayload {
  groupName: string;
  optionName: string;
  priceDelta: number;
}

interface CartItemPayload {
  itemId: string;
  catalogId: string;
  itemName: string;
  quantity: number;
  basePrice: number;
  modifiers: CartModifierPayload[];
  totalPrice: number;
}

interface OrderRequestBody {
  churchSlug: string;
  customerName: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  fulfillment?: string;
  paymentMethod?: string;
  scheduledFor?: string | null;
  smsOptIn?: boolean;
  tip?: number;
  items: CartItemPayload[];
}

function isValidFulfillment(value: string): value is "PICKUP" | "DELIVERY" | "DINE_IN" {
  return ["PICKUP", "DELIVERY", "DINE_IN"].includes(value);
}

export async function POST(req: NextRequest) {
  let body: OrderRequestBody;
  try {
    body = (await req.json()) as OrderRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { churchSlug, customerName, phone, email, notes, fulfillment, paymentMethod, scheduledFor, smsOptIn, tip, items } = body;

  if (!churchSlug || !customerName?.trim() || !items?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const fulfillmentType = fulfillment && isValidFulfillment(fulfillment) ? fulfillment : "PICKUP";

  // Resolve church
  const church = await db.church.findFirst({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: { id: true, currency: true },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore bypass tenancy for guest checkout
    _bypassTenancyCheck: true,
  });

  if (!church) {
    return NextResponse.json({ error: "Church not found" }, { status: 404 });
  }

  // Validate catalog belongs to church
  const firstCatalogId = items[0]?.catalogId;
  if (!firstCatalogId) {
    return NextResponse.json({ error: "Invalid items" }, { status: 400 });
  }
  const catalog = await db.catalog.findFirst({
    where: { id: firstCatalogId, churchId: church.id },
    select: { id: true },
  });

  if (!catalog) {
    return NextResponse.json({ error: "Invalid catalog" }, { status: 400 });
  }

  // Find or create guest customer
  const phoneNormalized = phone?.replace(/\D/g, "") || null;
  const emailNormalized = email?.trim().toLowerCase() || null;

  let customerId: string;

  if (phoneNormalized) {
    const existing = await db.customer.findFirst({
      where: { churchId: church.id, phoneNormalized },
      select: { id: true },
    });

    if (existing) {
      customerId = existing.id;
      const updates: Record<string, unknown> = {};
      if (smsOptIn) updates.smsOptIn = true;
      if (emailNormalized) {
        updates.email = email!.trim();
        updates.emailNormalized = emailNormalized;
      }
      if (Object.keys(updates).length > 0) {
        await db.customer.update({ where: { id: existing.id }, data: updates });
      }
    } else {
      const created = await db.customer.create({
        data: {
          churchId: church.id,
          name: customerName.trim(),
          phone: phone ?? null,
          phoneNormalized,
          email: email?.trim() ?? null,
          emailNormalized,
          smsOptIn: smsOptIn ?? false,
        },
        select: { id: true },
      });
      customerId = created.id;
    }
  } else if (emailNormalized) {
    // No phone but email — try dedup by email
    const existing = await db.customer.findFirst({
      where: { churchId: church.id, emailNormalized },
      select: { id: true },
    });

    if (existing) {
      customerId = existing.id;
    } else {
      const created = await db.customer.create({
        data: {
          churchId: church.id,
          name: customerName.trim(),
          email: email!.trim(),
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
        churchId: church.id,
        name: customerName.trim(),
      },
      select: { id: true },
    });
    customerId = created.id;
  }

  // Get next order number atomically via upsert on OrderCounter
  const counter = await db.orderCounter.upsert({
    where: { churchId: church.id },
    create: { churchId: church.id, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const tipAmount = typeof tip === "number" && tip >= 0 ? Math.round(tip) : 0;
  const orderTotal = subtotal + tipAmount;

  const resolvedPaymentMethod: PaymentMethod =
    paymentMethod === "cash" ? "CASH"
    : paymentMethod === "zelle" ? "ZELLE"
    : "PAY_ON_PICKUP";

  const order = await db.order.create({
    data: {
      churchId: church.id,
      catalogId: catalog.id,
      customerId,
      number: counter.value,
      channel: "ONLINE",
      fulfillment: fulfillmentType,
      status: "DRAFT",
      currency: church.currency,
      subtotal,
      tax: 0,
      tip: tipAmount,
      total: orderTotal,
      notes: notes ?? null,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      receiptLanguageVersion: 1,
      items: {
        create: items.map((item) => {
          const unitPrice = item.basePrice + item.modifiers.reduce((s, m) => s + m.priceDelta, 0);
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
          status: "PENDING",
          amount: orderTotal,
          currency: church.currency,
        },
      },
    },
    select: { id: true, number: true },
  });

  // Transition DRAFT → SUBMITTED to fire side effects (email, SMS, inventory)
  await transition(order.id, "SUBMITTED", { actorId: "guest", queue: effectQueue });

  return NextResponse.json({ orderId: order.id, orderNumber: order.number }, { status: 201 });
}
