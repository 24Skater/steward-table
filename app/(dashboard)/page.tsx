import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/top-bar";
import type { SessionMembership } from "@/lib/auth/types";
import type { OrderStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderEventRow {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  createdAt: Date;
  actor: { name: string | null } | null;
  order: { number: number; id: string };
}

interface LowStockRow {
  itemId: string;
  quantityOnHand: number;
  lowStockThreshold: number | null;
  item: { name: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardHomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const churchId = membership.churchId;

  // Today's date boundaries (UTC)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // -------------------------------------------------------------------------
  // Fetch: today's order stats
  // -------------------------------------------------------------------------
  const [todayOrders, recentEvents, lowStockItems] = await Promise.all([
    db.order.findMany({
      where: {
        churchId,
        createdAt: { gte: todayStart },
      },
      select: {
        id: true,
        status: true,
        total: true,
      },
    }),

    // Recent activity: last 10 OrderEvents with actor + order
    (db.orderEvent.findMany as PrismaBypass)({
      where: {},
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        createdAt: true,
        actor: { select: { name: true } },
        order: { select: { number: true, id: true } },
      },
    }) as Promise<OrderEventRow[]>,

    // Low stock alerts
    (db.inventoryItem.findMany as PrismaBypass)({
      where: {
        churchId,
        trackingEnabled: true,
        lowStockThreshold: { not: null },
      },
      select: {
        itemId: true,
        quantityOnHand: true,
        lowStockThreshold: true,
        item: { select: { name: true } },
      },
    }) as Promise<LowStockRow[]>,
  ]);

  // Derived stats
  const activeStatuses: OrderStatus[] = [
    "SUBMITTED",
    "CONFIRMED",
    "IN_KITCHEN",
    "READY",
    "AWAITING_PICKUP",
    "OUT_FOR_DELIVERY",
  ];
  const completedStatuses: OrderStatus[] = [
    "COMPLETED",
    "DELIVERED",
    "SERVED",
    "PICKED_UP",
  ];

  const totalOrders = todayOrders.length;
  const activeOrders = todayOrders.filter((o) =>
    activeStatuses.includes(o.status as OrderStatus),
  ).length;
  const completedOrders = todayOrders.filter((o) =>
    completedStatuses.includes(o.status as OrderStatus),
  ).length;
  const totalRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);

  const lowStock = (lowStockItems as LowStockRow[]).filter(
    (inv) =>
      inv.lowStockThreshold !== null &&
      inv.quantityOnHand < inv.lowStockThreshold,
  );

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Dashboard" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ---------------------------------------------------------------- */}
        {/* Stats row */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Today's Orders" value={String(totalOrders)} />
          <StatCard label="Active Now" value={String(activeOrders)} />
          <StatCard label="Completed" value={String(completedOrders)} />
          <StatCard label="Revenue Today" value={formatCurrency(totalRevenue)} />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Two-column body */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: activity feed (2/3) */}
          <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800">
                Recent Activity
              </h3>
            </div>
            <ul className="divide-y divide-slate-100">
              {(recentEvents as OrderEventRow[]).length === 0 ? (
                <li className="px-4 py-6 text-sm text-slate-400 text-center">
                  No recent activity
                </li>
              ) : (
                (recentEvents as OrderEventRow[]).map((event) => (
                  <li key={event.id}>
                    <Link
                      href={`/orders/${event.order.id}`}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      {/* Timeline dot */}
                      <span className="mt-1.5 shrink-0 w-2 h-2 rounded-full bg-blue-400" />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 leading-snug">
                          <span className="font-medium">
                            Order #{event.order.number}
                          </span>{" "}
                          {event.fromStatus ? (
                            <>
                              <StatusBadge status={event.fromStatus} />{" "}
                              <span className="text-slate-400">→</span>{" "}
                            </>
                          ) : null}
                          <StatusBadge status={event.toStatus} />
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {event.actor?.name ?? "System"} ·{" "}
                          {formatRelativeTime(new Date(event.createdAt))}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Right column (1/3) */}
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="px-4 py-3 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-800">
                  Quick Actions
                </h3>
              </div>
              <ul className="divide-y divide-slate-100">
                <QuickActionItem href={"/orders" as Route} label="New Order" />
                <QuickActionItem href={"/kitchen" as Route} label="View Kitchen" />
                <QuickActionItem href={"/reports" as Route} label="Reports" />
                <QuickActionItem href={"/menu" as Route} label="Manage Menu" />
              </ul>
            </div>

            {/* Low stock alerts */}
            {lowStock.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 shadow-sm">
                <div className="px-4 py-3 border-b border-amber-200">
                  <h3 className="text-sm font-semibold text-amber-800">
                    Low Stock Alerts
                  </h3>
                </div>
                <ul className="divide-y divide-amber-100">
                  {lowStock.slice(0, 5).map((inv) => (
                    <li
                      key={inv.itemId}
                      className="flex items-center justify-between px-4 py-2.5"
                    >
                      <span className="text-sm text-amber-900 truncate">
                        {inv.item.name}
                      </span>
                      <span className="text-xs font-medium text-amber-700 ml-2 shrink-0">
                        {inv.quantityOnHand} left
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (server-side, no interactivity needed)
// ---------------------------------------------------------------------------

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm px-4 py-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function QuickActionItem({ href, label }: { href: Route; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
      >
        <span>{label}</span>
        <span className="text-slate-400" aria-hidden="true">
          →
        </span>
      </Link>
    </li>
  );
}

const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  CONFIRMED: "Confirmed",
  IN_KITCHEN: "In Kitchen",
  READY: "Ready",
  AWAITING_PICKUP: "Awaiting Pickup",
  PICKED_UP: "Picked Up",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  SERVED: "Served",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
  REFUNDED: "Refunded",
};

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
