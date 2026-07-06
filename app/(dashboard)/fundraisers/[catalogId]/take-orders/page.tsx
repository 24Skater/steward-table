import { QuickEntry, type QuickEntryCatalog } from "@/components/fundraisers/quick-entry";
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ catalogId: string }>;
}

/** Same source of truth as the storefront checkout (payment-config route). */
function readDeliveryEnabled(brandTokens: unknown): boolean {
  const tokens =
    brandTokens && typeof brandTokens === "object"
      ? (brandTokens as Record<string, unknown>)
      : {};
  return typeof tokens.deliveryEnabled === "boolean" ? tokens.deliveryEnabled : false;
}

export default async function TakeOrdersPage({ params }: PageProps) {
  const { catalogId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const permitted = await can("order.create", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!permitted.allowed) redirect("/");

  const catalog = await db.catalog.findFirst({
    where: { id: catalogId, churchId: membership.churchId, status: "OPEN" },
    select: {
      id: true,
      name: true,
      minItemsForDelivery: true,
      church: {
        select: { name: true, settings: { select: { brandTokens: true } } },
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
  });
  if (!catalog) notFound();

  const quickEntryCatalog: QuickEntryCatalog = {
    catalogId: catalog.id,
    catalogName: catalog.name,
    churchName: catalog.church.name,
    minItemsForDelivery: catalog.minItemsForDelivery,
    deliveryEnabled: readDeliveryEnabled(catalog.church.settings?.brandTokens),
    items: catalog.items.map((ci) => ({
      itemId: ci.item.id,
      name: ci.item.name,
      price: ci.priceOverride ?? ci.item.defaultPrice,
      modifierGroups: ci.item.modifierGroups.map((img) => ({
        id: img.group.id,
        name: img.group.name,
        isRequired: img.group.defaultIsRequired,
        minSelections: img.group.defaultMinSelections,
        maxSelections: img.group.defaultMaxSelections,
        options: img.group.options,
      })),
    })),
  };

  const takerName = session.user.name ?? "staff";

  return (
    <QuickEntry
      catalog={quickEntryCatalog}
      endpoint={`/api/fundraisers/${catalog.id}/orders`}
      takerLabel={`as ${takerName}`}
    />
  );
}
