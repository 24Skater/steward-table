import { db } from "@/lib/db";
import {
  type CartItemPayload,
  type DeliveryAddressPayload,
  createStorefrontOrder,
} from "@/lib/orders/create-storefront-order";
import { type NextRequest, NextResponse } from "next/server";

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
  zoneId?: string | null;
  deliveryAddress?: DeliveryAddressPayload | null;
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

  const {
    churchSlug,
    customerName,
    phone,
    email,
    notes,
    fulfillment,
    paymentMethod,
    scheduledFor,
    smsOptIn,
    tip,
    zoneId,
    deliveryAddress,
    items,
  } = body;

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

  const result = await createStorefrontOrder({
    churchId: church.id,
    currency: church.currency,
    customerName,
    phone,
    email,
    notes,
    fulfillment: fulfillmentType,
    paymentMethod,
    scheduledFor,
    smsOptIn,
    tip,
    zoneId,
    deliveryAddress,
    items,
    channel: "ONLINE",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { orderId: result.orderId, orderNumber: result.orderNumber },
    { status: 201 },
  );
}
