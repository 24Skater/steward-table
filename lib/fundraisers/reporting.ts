import type { PrismaClient } from "@prisma/client";

export interface ChannelBreakdownItem {
  channel: string;
  orders: number;
  revenue: number;
}

export interface MinistryRollupItem {
  name: string;
  orders: number;
  revenue: number;
}

/**
 * Per-channel order count and revenue for a church over the period starting
 * at `since`. Counts every non-draft, non-canceled order.
 */
export async function getChannelBreakdown(
  db: PrismaClient,
  churchId: string,
  since: Date,
): Promise<ChannelBreakdownItem[]> {
  const rows = await db.order.groupBy({
    by: ["channel"],
    where: {
      churchId,
      createdAt: { gte: since },
      status: { notIn: ["DRAFT", "CANCELED"] },
    },
    _count: { _all: true },
    _sum: { total: true },
    orderBy: { _count: { channel: "desc" } },
  });

  return rows.map((row) => ({
    channel: row.channel,
    orders: row._count._all,
    revenue: row._sum.total ?? 0,
  }));
}

/**
 * Per-ministry order count and revenue for a church over the period starting
 * at `since`. Orders roll up through their catalog's ministry; catalogs with
 * no ministry are omitted.
 */
export async function getMinistryRollup(
  db: PrismaClient,
  churchId: string,
  since: Date,
): Promise<MinistryRollupItem[]> {
  const revenueRows = await db.order.groupBy({
    by: ["catalogId"],
    where: {
      churchId,
      createdAt: { gte: since },
      status: { notIn: ["DRAFT", "CANCELED"] },
    },
    _count: { _all: true },
    _sum: { total: true },
  });
  if (revenueRows.length === 0) return [];

  const catalogsWithMinistry = await db.catalog.findMany({
    where: { churchId, id: { in: revenueRows.map((r) => r.catalogId) } },
    select: { id: true, ministry: { select: { id: true, name: true } } },
  });
  const ministryByCatalog = new Map(catalogsWithMinistry.map((c) => [c.id, c.ministry]));

  const rollup = new Map<string, { name: string; orders: number; revenue: number }>();
  for (const row of revenueRows) {
    const ministry = ministryByCatalog.get(row.catalogId);
    if (!ministry) continue;
    const entry = rollup.get(ministry.id) ?? { name: ministry.name, orders: 0, revenue: 0 };
    entry.orders += row._count._all;
    entry.revenue += row._sum.total ?? 0;
    rollup.set(ministry.id, entry);
  }

  return [...rollup.values()].sort((a, b) => b.revenue - a.revenue);
}
