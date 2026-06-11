import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripeForChurch } from "@/lib/stripe/client";

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

interface CheckoutRequestBody {
  churchSlug: string;
  customerName: string;
  phone?: string | null;
  notes?: string | null;
  fulfillment?: string;
  zoneId?: string | null;
  scheduledFor?: string | null;
  items: CartItemPayload[];
}

function isValidFulfillment(value: string): value is "PICKUP" | "DELIVERY" | "DINE_IN" {
  return ["PICKUP", "DELIVERY", "DINE_IN"].includes(value);
}

export async function POST(req: NextRequest) {
  let body: CheckoutRequestBody;
  try {
    body = (await req.json()) as CheckoutRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { churchSlug, customerName, phone, notes, fulfillment, zoneId, scheduledFor, items } = body;

  if (!churchSlug || !customerName?.trim() || !items?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const fulfillmentType = fulfillment && isValidFulfillment(fulfillment) ? fulfillment : "PICKUP";

  // Resolve church (bypass tenancy for guest checkout)
  const church = await (db.church.findFirst as Function)({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: { id: true, name: true, currency: true },
    _bypassTenancyCheck: true,
  });

  if (!church) {
    return NextResponse.json({ error: "Church not found" }, { status: 404 });
  }

  // Load Stripe for this church
  const stripe = await getStripeForChurch(church.id as string);
  if (!stripe) {
    return NextResponse.json({ error: "Online payment not configured" }, { status: 503 });
  }

  // Validate catalog belongs to church
  const firstCatalogId = items[0]?.catalogId;
  if (!firstCatalogId) {
    return NextResponse.json({ error: "Invalid items" }, { status: 400 });
  }
  const catalog = await db.catalog.findFirst({
    where: { id: firstCatalogId, churchId: church.id as string },
    select: { id: true },
  });

  if (!catalog) {
    return NextResponse.json({ error: "Invalid catalog" }, { status: 400 });
  }

  // Look up delivery zone if provided
  let deliveryFeeCents = 0;
  if (zoneId) {
    const zone = await db.deliveryZone.findFirst({
      where: { id: zoneId, churchId: church.id as string },
      select: { id: true, feeCents: true, name: true },
    });
    if (zone) {
      deliveryFeeCents = zone.feeCents;
    }
  }

  // Find or create guest customer
  const phoneNormalized = phone?.replace(/\D/g, "") || null;
  let customerId: string;

  if (phoneNormalized) {
    const existing = await db.customer.findFirst({
      where: { churchId: church.id as string, phoneNormalized },
      select: { id: true },
    });

    if (existing) {
      customerId = existing.id;
    } else {
      const created = await db.customer.create({
        data: {
          churchId: church.id as string,
          name: customerName.trim(),
          phone: phone ?? null,
          phoneNormalized,
        },
        select: { id: true },
      });
      customerId = created.id;
    }
  } else {
    const created = await db.customer.create({
      data: {
        churchId: church.id as string,
        name: customerName.trim(),
      },
      select: { id: true },
    });
    customerId = created.id;
  }

  // Get next order number atomically
  const counter = await db.orderCounter.upsert({
    where: { churchId: church.id as string },
    create: { churchId: church.id as string, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const orderTotal = subtotal + deliveryFeeCents;

  // Create a DRAFT order so we have an orderId before redirecting to Stripe
  const order = await db.order.create({
    data: {
      churchId: church.id as string,
      catalogId: catalog.id,
      customerId,
      number: counter.value,
      channel: "ONLINE",
      fulfillment: fulfillmentType,
      status: "DRAFT",
      currency: church.currency as string,
      subtotal,
      tax: 0,
      tip: 0,
      total: orderTotal,
      notes: notes ?? null,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      receiptLanguageVersion: 1,
      items: {
        create: items.map((item) => {
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
          method: "STRIPE_CARD",
          status: "PENDING",
          amount: orderTotal,
          currency: church.currency as string,
        },
      },
    },
    select: { id: true, number: true },
  });

  const orderId = order.id;
  const baseUrl = process.env.NEXTAUTH_URL ?? "";

  // Build Stripe line items
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item) => {
      const unitAmount =
        item.basePrice + item.modifiers.reduce((s, m) => s + m.priceDelta, 0);
      return {
        price_data: {
          currency: (church.currency as string).toLowerCase(),
          product_data: { name: item.itemName },
          unit_amount: unitAmount,
        },
        quantity: item.quantity,
      } satisfies Stripe.Checkout.SessionCreateParams.LineItem;
    });

  // Add delivery fee as a separate line item if applicable
  if (deliveryFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: (church.currency as string).toLowerCase(),
        product_data: { name: "Delivery fee" },
        unit_amount: deliveryFeeCents,
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: lineItems,
    metadata: { orderId, churchId: church.id as string },
    success_url: `${baseUrl}/${churchSlug}/checkout/success?session_id={CHECKOUT_SESSION_ID}&orderId=${orderId}`,
    cancel_url: `${baseUrl}/${churchSlug}/checkout/cancel?orderId=${orderId}`,
  });

  return NextResponse.json({ sessionId: session.id, url: session.url }, { status: 200 });
}
