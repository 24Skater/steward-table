import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { getKitchenRevenue } from "@/lib/kitchens/reporting";
import type { SessionMembership } from "@/lib/auth/types";
import type { OrderStatus } from "@prisma/client";

// Statuses that represent a successfully fulfilled order
const COMPLETED_STATUSES: OrderStatus[] = [
  "PICKED_UP",
  "DELIVERED",
  "SERVED",
  "COMPLETED",
];

type Range = "today" | "week" | "month";

function getDateRange(range: Range): Date {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  switch (range) {
    case "today":
      return startOfToday;
    case "week": {
      const start = new Date(startOfToday);
      start.setDate(startOfToday.getDate() - startOfToday.getDay());
      return start;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const rawRange = searchParams.get("range") ?? "today";
  const churchId = searchParams.get("churchId");

  if (!churchId) {
    return NextResponse.json({ error: "churchId required" }, { status: 400 });
  }

  // Verify the caller has an active membership for this church
  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rbac = await can("report.read", {
    userId: session.user.id,
    churchId,
    roles: membership.roles,
  });
  if (!rbac.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const range = (["today", "week", "month"].includes(rawRange)
    ? rawRange
    : "today") as Range;

  const rangeStart = getDateRange(range);

  // Determine the start of the current week for top items (always week-based)
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

  const [
    totalOrders,
    completedOrders,
    revenueResult,
    statusBreakdown,
    topItemsRaw,
  ] = await Promise.all([
    // Total orders in range
    db.order.count({
      where: { churchId, createdAt: { gte: rangeStart } },
    }),

    // Completed orders in range
    db.order.count({
      where: {
        churchId,
        createdAt: { gte: rangeStart },
        status: { in: COMPLETED_STATUSES },
      },
    }),

    // Revenue from completed orders in range (total field is in cents)
    db.order.aggregate({
      where: {
        churchId,
        createdAt: { gte: rangeStart },
        status: { in: COMPLETED_STATUSES },
      },
      _sum: { total: true },
    }),

    // Status breakdown for the selected range
    db.order.groupBy({
      by: ["status"],
      where: { churchId, createdAt: { gte: rangeStart } },
      _count: { _all: true },
      orderBy: { _count: { status: "desc" } },
    }),

    // Top items this week (always week-scoped regardless of range selector)
    db.orderItem.groupBy({
      by: ["itemName"],
      where: {
        order: {
          churchId,
          createdAt: { gte: startOfWeek },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const revenue = revenueResult._sum.total ?? 0;
  const averageOrderValue =
    totalOrders > 0 ? Math.round(revenue / totalOrders) : 0;

  const byKitchen = await getKitchenRevenue(
    db,
    churchId,
    rangeStart,
    COMPLETED_STATUSES,
  );

  return NextResponse.json({
    totalOrders,
    completedOrders,
    revenue,
    averageOrderValue,
    statusBreakdown: statusBreakdown.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    topItems: topItemsRaw.map((row) => ({
      itemName: row.itemName,
      count: row._sum.quantity ?? 0,
    })),
    byKitchen,
  });
}
