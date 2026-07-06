import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ catalogId: string }> },
) {
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

  const result = await can("fundraiser.create", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { catalogId } = await params;

  const catalog = await db.catalog.findFirst({
    where: { id: catalogId, churchId: membership.churchId },
    select: {
      name: true,
      description: true,
      ministryId: true,
      kitchenId: true,
      minItemsForDelivery: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          priceOverride: true,
          item: {
            select: {
              name: true,
              defaultPrice: true,
              imageUrl: true,
              modifierGroups: {
                orderBy: { sortOrder: "asc" },
                select: {
                  group: {
                    select: {
                      name: true,
                      defaultIsRequired: true,
                      defaultMinSelections: true,
                      defaultMaxSelections: true,
                      options: {
                        orderBy: { sortOrder: "asc" },
                        select: {
                          name: true,
                          priceDelta: true,
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
    },
  });

  if (!catalog) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: catalog.name,
    description: catalog.description,
    ministryId: catalog.ministryId,
    minItemsForDelivery: catalog.minItemsForDelivery,
    kitchenId: catalog.kitchenId,
    items: catalog.items.map((ci) => ({
      name: ci.item.name,
      price: ci.priceOverride ?? ci.item.defaultPrice,
      imageUrl: ci.item.imageUrl,
      modifierGroups: ci.item.modifierGroups.map((img) => ({
        name: img.group.name,
        isRequired: img.group.defaultIsRequired,
        minSelections: img.group.defaultMinSelections,
        maxSelections: img.group.defaultMaxSelections,
        options: img.group.options.map((opt) => ({
          name: opt.name,
          priceDelta: opt.priceDelta,
        })),
      })),
    })),
  });
}
