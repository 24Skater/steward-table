import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ churchSlug: string }> },
) {
  const { churchSlug } = await params;

  const church = await (db.church.findFirst as Function)({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      settings: { select: { acceptCash: true, acceptZelle: true, brandTokens: true } },
    },
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
  const settings = church.settings as { acceptCash?: boolean; acceptZelle?: boolean; brandTokens?: unknown } | null;

  const tokens =
    settings?.brandTokens && typeof settings.brandTokens === "object"
      ? (settings.brandTokens as Record<string, unknown>)
      : {};

  return NextResponse.json({
    stripeEnabled,
    acceptCash: settings?.acceptCash ?? true,
    acceptZelle: settings?.acceptZelle ?? true,
    pickupEnabled: typeof tokens.pickupEnabled === "boolean" ? tokens.pickupEnabled : true,
    deliveryEnabled: typeof tokens.deliveryEnabled === "boolean" ? tokens.deliveryEnabled : false,
    dineInEnabled: typeof tokens.dineInEnabled === "boolean" ? tokens.dineInEnabled : false,
    churchName: (church as { name: string }).name,
  });
}
