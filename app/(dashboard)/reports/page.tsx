import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/top-bar";
import { ReportsPage } from "@/components/reports";
import type { ReportsData } from "@/components/reports";
import type { OrderStatus } from "@prisma/client";

const COMPLETED_STATUSES: OrderStatus[] = [
  "PICKED_UP",
  "DELIVERED",
  "SERVED",
  "COMPLETED",
];

export default async function ReportsPageRoute() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const activeMembership = session.user.memberships?.find(
    (m) => m.status === "ACTIVE",
  );
  if (!activeMembership) {
    redirect("/auth/sign-in");
  }

  const { churchId } = activeMembership;

  // Date boundaries
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
    db.order.count({
      where: { churchId, createdAt: { gte: startOfToday } },
    }),

    db.order.count({
      where: {
        churchId,
        createdAt: { gte: startOfToday },
        status: { in: COMPLETED_STATUSES },
      },
    }),

    db.order.aggregate({
      where: {
        churchId,
        createdAt: { gte: startOfToday },
        status: { in: COMPLETED_STATUSES },
      },
      _sum: { total: true },
    }),

    db.order.groupBy({
      by: ["status"],
      where: { churchId, createdAt: { gte: startOfToday } },
      _count: { _all: true },
      orderBy: { _count: { status: "desc" } },
    }),

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

  const initialData: ReportsData = {
    totalOrders,
    completedOrders,
    revenue,
    averageOrderValue:
      totalOrders > 0 ? Math.round(revenue / totalOrders) : 0,
    statusBreakdown: statusBreakdown.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    topItems: topItemsRaw.map((row) => ({
      itemName: row.itemName,
      count: row._sum.quantity ?? 0,
    })),
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Reports" />
      <ReportsPage initialData={initialData} churchId={churchId} />
    </div>
  );
}
