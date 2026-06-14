import type { OrderStatus, Prisma, PrismaClient } from "@prisma/client";

export interface KitchenScopeInput {
  id: string;
  isDefault: boolean;
}

/**
 * Resolve the catalog IDs whose orders belong on this kitchen's screen.
 * The default kitchen additionally owns any catalog with no explicit kitchen.
 */
export async function getKitchenCatalogIds(
  db: PrismaClient,
  churchId: string,
  kitchen: KitchenScopeInput,
): Promise<string[]> {
  const where: Prisma.CatalogWhereInput = kitchen.isDefault
    ? { churchId, OR: [{ kitchenId: kitchen.id }, { kitchenId: null }] }
    : { churchId, kitchenId: kitchen.id };

  const rows = await db.catalog.findMany({ where, select: { id: true } });
  return rows.map((r) => r.id);
}

/**
 * Build the Prisma `where` for a kitchen's active orders. Order.catalogId is
 * required, so an empty `catalogIds` list matches no orders.
 */
export function buildKitchenOrderWhere(
  churchId: string,
  catalogIds: string[],
  statuses: OrderStatus[],
): Prisma.OrderWhereInput {
  return {
    churchId,
    status: { in: statuses },
    catalogId: { in: catalogIds },
  };
}
