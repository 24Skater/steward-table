import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import {
  type CartItemPayload,
  type DeliveryAddressPayload,
  createStorefrontOrder,
} from "@/lib/orders/create-storefront-order";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ catalogId: string }>;
}

interface StaffOrderBody {
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("order.create", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { catalogId } = await params;

  let body: StaffOrderBody;
  try {
    body = (await req.json()) as StaffOrderBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (
    !body.customerName?.trim() ||
    !body.phone?.trim() ||
    !body.clientRequestId?.trim() ||
    !body.items?.length
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (body.items.some((item) => item.catalogId !== catalogId)) {
    return NextResponse.json({ error: "Items do not match this fundraiser" }, { status: 400 });
  }

  const church = await (db.church.findFirst as PrismaBypass)({
    where: { id: membership.churchId },
    select: { currency: true },
    _bypassTenancyCheck: true,
  });
  if (!church) {
    return NextResponse.json({ error: "Church not found" }, { status: 404 });
  }

  const orderResult = await createStorefrontOrder({
    churchId: membership.churchId,
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
    takenById: session.user.id,
    clientRequestId: body.clientRequestId,
    markPaidCash: body.markPaidCash,
  });

  if (!orderResult.ok) {
    return NextResponse.json({ error: orderResult.error }, { status: orderResult.status });
  }
  return NextResponse.json(
    {
      orderId: orderResult.orderId,
      orderNumber: orderResult.orderNumber,
      deduplicated: orderResult.deduplicated,
    },
    { status: orderResult.deduplicated ? 200 : 201 },
  );
}
