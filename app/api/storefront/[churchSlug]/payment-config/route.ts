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

  const apiKey = await (db.apiKey.findFirst as Function)({
    where: { churchId: church.id, provider: "stripe", deletedAt: null },
    select: { id: true, encrypted: true },
    _bypassTenancyCheck: true,
  });

  const stripeEnabled = !!(apiKey?.encrypted && (apiKey.encrypted as Buffer).length > 0);

  return NextResponse.json({ stripeEnabled });
}
