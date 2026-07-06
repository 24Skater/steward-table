import { db } from "@/lib/db";
import { validateVolunteerToken } from "@/lib/fundraisers/volunteer-links";
import {
  type CartItemPayload,
  type DeliveryAddressPayload,
  createStorefrontOrder,
} from "@/lib/orders/create-storefront-order";
import { type NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ token: string }>;
}

interface VolunteerOrderBody {
  volunteerName: string;
  customerName: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  fulfillment?: "PICKUP" | "DELIVERY";
  zoneId?: string | null;
  deliveryAddress?: DeliveryAddressPayload | null;
  scheduledFor?: string | null;
  markPaidCash?: boolean;
  clientRequestId: string;
  items: CartItemPayload[];
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const link = await validateVolunteerToken(token);
  if (!link) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  let body: VolunteerOrderBody;
  try {
    body = (await req.json()) as VolunteerOrderBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (
    !body.volunteerName?.trim() ||
    !body.customerName?.trim() ||
    !body.phone?.trim() ||
    !body.clientRequestId?.trim() ||
    !body.items?.length
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // A token authorizes exactly one fundraiser
  if (body.items.some((item) => item.catalogId !== link.catalogId)) {
    return NextResponse.json({ error: "Items do not match this fundraiser" }, { status: 400 });
  }

  const church = await (db.church.findUnique as PrismaBypass)({
    where: { id: link.churchId },
    select: { currency: true },
    _bypassTenancyCheck: true,
  });
  if (!church) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const result = await createStorefrontOrder({
    churchId: link.churchId,
    currency: church.currency,
    customerName: body.customerName,
    phone: body.phone,
    email: body.email,
    notes: body.notes,
    fulfillment: body.fulfillment === "DELIVERY" ? "DELIVERY" : "PICKUP",
    paymentMethod: body.markPaidCash ? "cash" : undefined,
    scheduledFor: body.scheduledFor,
    zoneId: body.zoneId,
    deliveryAddress: body.deliveryAddress,
    items: body.items,
    channel: "VOLUNTEER",
    takenByName: body.volunteerName.trim().slice(0, 100),
    clientRequestId: body.clientRequestId,
    markPaidCash: body.markPaidCash,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(
    { orderId: result.orderId, orderNumber: result.orderNumber, deduplicated: result.deduplicated },
    { status: result.deduplicated ? 200 : 201 },
  );
}
