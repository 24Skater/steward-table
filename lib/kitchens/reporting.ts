import type { OrderStatus, PrismaClient } from "@prisma/client";

export interface KitchenRevenueItem {
  kitchenName: string;
  orders: number;
  revenue: number;
}

interface KitchenRow {
  id: string;
  name: string;
  isDefault: boolean;
}

interface CatalogRow {
  id: string;
  kitchenId: string | null;
}

interface RevenueRow {
  catalogId: string;
  orders: number;
  revenue: number;
}

/**
 * Roll up per-catalog order/revenue totals into per-kitchen totals. Catalogs
 * with no kitchen (or an unknown kitchen) are attributed to the default kitchen.
 * Returns one entry per kitchen, preserving the input kitchen order.
 */
export function rollUpKitchenRevenue(
  kitchens: KitchenRow[],
  catalogs: CatalogRow[],
  revenueRows: RevenueRow[],
): KitchenRevenueItem[] {
  const defaultKitchenId = kitchens.find((k) => k.isDefault)?.id ?? kitchens[0]?.id ?? null;

  const catalogToKitchen = new Map<string, string | null>();
  for (const catalog of catalogs) {
    catalogToKitchen.set(catalog.id, catalog.kitchenId ?? defaultKitchenId);
  }

  const totals = new Map<string, { orders: number; revenue: number }>();
  for (const kitchen of kitchens) {
    totals.set(kitchen.id, { orders: 0, revenue: 0 });
  }

  for (const row of revenueRows) {
    const kitchenId = catalogToKitchen.get(row.catalogId) ?? defaultKitchenId;
    if (!kitchenId) continue;
    const acc = totals.get(kitchenId) ?? { orders: 0, revenue: 0 };
    acc.orders += row.orders;
    acc.revenue += row.revenue;
    totals.set(kitchenId, acc);
  }

  return kitchens.map((kitchen) => ({
    kitchenName: kitchen.name,
    orders: totals.get(kitchen.id)?.orders ?? 0,
    revenue: totals.get(kitchen.id)?.revenue ?? 0,
  }));
}

/**
 * Compute per-kitchen order count and revenue for a church over the period
 * starting at `since`, counting only the given (completed) statuses.
 */
export async function getKitchenRevenue(
  db: PrismaClient,
  churchId: string,
  since: Date,
  completedStatuses: OrderStatus[],
): Promise<KitchenRevenueItem[]> {
  const [kitchens, catalogs, revenueRows] = await Promise.all([
    db.kitchen.findMany({
      where: { churchId },
      select: { id: true, name: true, isDefault: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    db.catalog.findMany({
      where: { churchId },
      select: { id: true, kitchenId: true },
    }),
    db.order.groupBy({
      by: ["catalogId"],
      where: {
        churchId,
        createdAt: { gte: since },
        status: { in: completedStatuses },
      },
      _count: { _all: true },
      _sum: { total: true },
    }),
  ]);

  const rows: RevenueRow[] = revenueRows.map((r) => ({
    catalogId: r.catalogId,
    orders: r._count._all,
    revenue: r._sum.total ?? 0,
  }));

  return rollUpKitchenRevenue(kitchens, catalogs, rows);
}
