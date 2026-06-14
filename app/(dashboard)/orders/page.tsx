import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/top-bar";
import { OrdersPage } from "@/components/orders";
import type { OrderRowData, DriverOption } from "@/components/orders";

export type DateRange = "today" | "week" | "month" | "all" | "scheduled";

const VALID_RANGES = new Set<string>(["today", "week", "month", "all", "scheduled"]);

function getRangeStart(range: DateRange): Date | undefined {
  const now = new Date();
  switch (range) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case "week": {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case "month": {
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case "all":
    case "scheduled":
      return undefined;
  }
}

interface OrdersPageRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OrdersPageRoute({ searchParams }: OrdersPageRouteProps) {
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

  const resolvedParams = await searchParams;
  const rawRange = resolvedParams.range;
  const rangeParam = typeof rawRange === "string" && VALID_RANGES.has(rawRange)
    ? (rawRange as DateRange)
    : "today";

  const rangeStart = getRangeStart(rangeParam);

  const now = new Date();

  const [raw, driverMemberships] = await Promise.all([
    db.order.findMany({
      where: {
        churchId,
        ...(rangeParam === "scheduled"
          ? { scheduledFor: { not: null, gte: now } }
          : rangeStart
            ? { createdAt: { gte: rangeStart } }
            : {}),
      },
      orderBy: rangeParam === "scheduled" ? { scheduledFor: "asc" } : { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        number: true,
        status: true,
        fulfillment: true,
        createdAt: true,
        scheduledFor: true,
        total: true,
        customer: {
          select: { name: true },
        },
        _count: {
          select: { items: true },
        },
        deliveryInfo: {
          select: {
            driverId: true,
            driver: { select: { id: true, name: true } },
          },
        },
      },
    }),
    // Fetch active DRIVER members for the assignment dropdown
    (db.membership.findMany as PrismaBypass)({
      where: {
        churchId,
        status: "ACTIVE",
        roles: { has: "DRIVER" },
      },
      select: {
        userId: true,
        user: { select: { name: true } },
      },
      _bypassTenancyCheck: true,
    }) as Promise<Array<{ userId: string; user: { name: string | null } }>>,
  ]);

  const drivers: DriverOption[] = driverMemberships.map((m) => ({
    id: m.userId,
    name: m.user.name ?? "Driver",
  }));

  // Dates arrive as Date objects from Prisma; pass as-is (serialized by Next.js)
  const orders: OrderRowData[] = raw.map((o: (typeof raw)[number]) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    fulfillment: o.fulfillment,
    createdAt: o.createdAt,
    scheduledFor: o.scheduledFor,
    total: o.total,
    customer: { name: o.customer.name },
    _count: { items: o._count.items },
    deliveryInfo: o.deliveryInfo
      ? {
          driverId: o.deliveryInfo.driverId,
          driverName: o.deliveryInfo.driver?.name ?? null,
        }
      : null,
  }));

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Orders" />
      <OrdersPage orders={orders} churchId={churchId} range={rangeParam} drivers={drivers} />
    </div>
  );
}
