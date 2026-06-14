import { db } from "@/lib/db";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ churchSlug: string }> },
) {
  const { churchSlug } = await params;

  const church = await (db.church.findFirst as PrismaBypass)({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: { id: true, settings: { select: { brandTokens: true } } },
    _bypassTenancyCheck: true,
  });

  if (!church) {
    return NextResponse.json({ error: "Church not found" }, { status: 404 });
  }

  const tokens =
    church.settings?.brandTokens && typeof church.settings.brandTokens === "object"
      ? (church.settings.brandTokens as Record<string, unknown>)
      : {};

  const tipEnabled = typeof tokens.tipEnabled === "boolean" ? tokens.tipEnabled : false;
  const tipPercentages = Array.isArray(tokens.tipPercentages)
    ? (tokens.tipPercentages as unknown[]).filter((v): v is number => typeof v === "number")
    : [10, 15, 20];

  return NextResponse.json({ tipEnabled, tipPercentages });
}
