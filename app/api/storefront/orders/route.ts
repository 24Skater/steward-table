import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
  notes?: string | null;
  fulfillment?: string;
  scheduledFor?: string | null;
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

  const { churchSlug, customerName, phone, notes, fulfillment, scheduledFor, items } = body;

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

  let customerId: string;

  if (phoneNormalized) {
    const existing = await db.customer.findFirst({
      where: { churchId: church.id, phoneNormalized },
      select: { id: true },
    });

    if (existing) {
      customerId = existing.id;
    } else {
      const created = await db.customer.create({
        data: {
          churchId: church.id,
          name: customerName.trim(),
          phone: phone ?? null,
          phoneNormalized,
        },
        select: { id: true },
      });
      customerId = created.id;
    }
  } else {
    // No phone — always create a new guest customer
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

  const order = await db.order.create({
    data: {
      churchId: church.id,
      catalogId: catalog.id,
      customerId,
      number: counter.value,
      channel: "ONLINE",
      fulfillment: fulfillmentType,
      status: "SUBMITTED",
      currency: church.currency,
      subtotal,
      tax: 0,
      tip: 0,
      total: subtotal,
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
    },
    select: { id: true, number: true },
  });

  return NextResponse.json({ orderId: order.id, orderNumber: order.number }, { status: 201 });
}
