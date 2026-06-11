import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPaymentAdapter } from "@/lib/payments";

interface RequestBody {
  orderId?: string;
}

interface OrderItem {
  quantity: number;
  unitPrice: number;
  itemName: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as RequestBody | null;

  if (!body?.orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — Prisma client types are not generated yet; models exist at runtime
  const order = await db.order.findUnique({
    where: { id: body.orderId },
    include: {
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          itemName: true,
        },
      },
      church: {
        include: { settings: true },
      },
    },
    _bypassTenancyCheck: true,
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Check whether the church has a Stripe key configured
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const stripeKeyRow = await db.apiKey.findFirst({
    where: { churchId: order.churchId, provider: "stripe", isLive: true },
    select: { id: true },
    _bypassTenancyCheck: true,
  });

  if (!stripeKeyRow) {
    // No Stripe configured — order proceeds without a payment step
    return NextResponse.json({ skipPayment: true });
  }

  const stripeMode = (order.church?.settings?.stripeMode ?? "BYO") as string;
  const adapter = getPaymentAdapter(stripeMode === "CONNECT" ? "CONNECT" : "BYO");

  const baseUrl = req.nextUrl.origin;
  const churchSlug = order.church?.slug as string;

  try {
    const session = await adapter.createCheckoutSession({
      orderId: order.id,
      churchId: order.churchId,
      lineItems: (order.items as OrderItem[]).map((item) => ({
        name: item.itemName,
        unitAmount: item.unitPrice,
        quantity: item.quantity,
      })),
      successUrl: `${baseUrl}/${churchSlug}/checkout/success?orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/${churchSlug}/checkout/cancel?orderId=${order.id}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment setup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
