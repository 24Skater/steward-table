import { db } from "@/lib/db";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ churchSlug: string }> },
) {
  const { churchSlug } = await params;

  const church = await (db.church.findFirst as PrismaBypass)({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: { id: true },
    _bypassTenancyCheck: true,
  });

  if (!church) {
    return NextResponse.json({ error: "Church not found" }, { status: 404 });
  }

  const [zones, openCatalog] = await Promise.all([
    (db.deliveryZone.findMany as PrismaBypass)({
      where: { churchId: church.id },
      select: {
        id: true,
        name: true,
        postalCodes: true,
        feeCents: true,
        minOrderCents: true,
      },
      orderBy: { name: "asc" },
    }),
    db.catalog.findFirst({
      where: { churchId: church.id, status: "OPEN" },
      select: { minItemsForDelivery: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    zones,
    minItemsForDelivery: openCatalog?.minItemsForDelivery ?? null,
  });
}
