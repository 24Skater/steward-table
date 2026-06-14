import { createMagicLinkToken } from "@/lib/auth/create-phone-session";
import { db } from "@/lib/db";
import { sendSms } from "@/lib/sms";
import { type NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ churchSlug: string; orderId: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { churchSlug, orderId } = await params;

  const church = (await (db.church.findFirst as PrismaBypass)({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: { id: true, name: true },
    _bypassTenancyCheck: true,
  })) as { id: string; name: string } | null;

  if (!church) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const order = await db.order.findFirst({
    where: { id: orderId, churchId: church.id },
    select: {
      id: true,
      number: true,
      customerId: true,
      customer: { select: { id: true, phone: true, userId: true } },
    },
  });

  if (!order?.customer?.phone) {
    return NextResponse.json({ error: "No phone on record for this order" }, { status: 422 });
  }

  if (order.customer.userId) {
    // Already linked — no need to send another link
    return NextResponse.json({ already_linked: true });
  }

  const phone = order.customer.phone;
  const { token } = await createMagicLinkToken(phone);

  const baseUrl = process.env.NEXTAUTH_URL ?? "";
  const callbackUrl = `/${churchSlug}/order/${orderId}`;
  const magicUrl = `${baseUrl}/${churchSlug}/auth/verify?token=${token}&phone=${encodeURIComponent(phone)}&orderId=${orderId}&next=${encodeURIComponent(callbackUrl)}`;

  await sendSms(phone, `Your Steward Table order tracking link:\n${magicUrl}`, church.id);

  return NextResponse.json({ sent: true });
}
