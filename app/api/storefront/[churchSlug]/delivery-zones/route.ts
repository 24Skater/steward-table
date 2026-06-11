import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ churchSlug: string }> },
) {
  const { churchSlug } = await params;

  const church = await (db.church.findFirst as Function)({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: { id: true },
    _bypassTenancyCheck: true,
  });

  if (!church) {
    return NextResponse.json({ error: "Church not found" }, { status: 404 });
  }

  const zones = await (db.deliveryZone.findMany as Function)({
    where: { churchId: church.id },
    select: {
      id: true,
      name: true,
      postalCodes: true,
      feeCents: true,
      minOrderCents: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(zones);
}
