import { db } from "@/lib/db";
import { validateVolunteerToken } from "@/lib/fundraisers/volunteer-links";
import { type NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const link = await validateVolunteerToken(token);
  if (!link) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  const catalog = await (db.catalog.findUnique as PrismaBypass)({
    where: { id: link.catalogId },
    select: {
      id: true,
      name: true,
      minItemsForDelivery: true,
      church: {
        select: {
          name: true,
          currency: true,
          accentColor: true,
          settings: { select: { brandTokens: true } },
        },
      },
      items: {
        orderBy: { sortOrder: "asc" },
        where: { isAvailable: true },
        select: {
          priceOverride: true,
          item: {
            select: {
              id: true,
              name: true,
              defaultPrice: true,
              imageUrl: true,
              modifierGroups: {
                orderBy: { sortOrder: "asc" },
                select: {
                  group: {
                    select: {
                      id: true,
                      name: true,
                      defaultIsRequired: true,
                      defaultMinSelections: true,
                      defaultMaxSelections: true,
                      options: {
                        orderBy: { sortOrder: "asc" },
                        select: { id: true, name: true, priceDelta: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    _bypassTenancyCheck: true,
  });

  if (!catalog) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  // Mirror the storefront checkout's delivery toggle (brandTokens.deliveryEnabled)
  // without leaking the full settings blob to the public endpoint.
  const { church, ...rest } = catalog as {
    church: {
      name: string;
      currency: string;
      accentColor: string | null;
      settings: { brandTokens: unknown } | null;
    };
  } & Record<string, unknown>;
  const tokens =
    church.settings?.brandTokens && typeof church.settings.brandTokens === "object"
      ? (church.settings.brandTokens as Record<string, unknown>)
      : {};

  return NextResponse.json({
    ...rest,
    church: { name: church.name, currency: church.currency, accentColor: church.accentColor },
    deliveryEnabled: typeof tokens.deliveryEnabled === "boolean" ? tokens.deliveryEnabled : false,
  });
}
