"use client";

import { useState, useEffect, useCallback } from "react";
import { MetricCard } from "./metric-card";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReportsRange = "today" | "week" | "month";

export interface StatusBreakdownItem {
  status: string;
  count: number;
}

export interface TopItem {
  itemName: string;
  count: number;
}

export interface ReportsData {
  totalOrders: number;
  completedOrders: number;
  revenue: number;
  averageOrderValue: number;
  statusBreakdown: StatusBreakdownItem[];
  topItems: TopItem[];
}

interface ReportsPageProps {
  initialData: ReportsData;
  churchId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

const STATUS_LABELS: Record<string, string> = {
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

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-300",
  SUBMITTED: "bg-blue-400",
  CONFIRMED: "bg-blue-500",
  IN_KITCHEN: "bg-amber-400",
  READY: "bg-amber-500",
  AWAITING_PICKUP: "bg-amber-500",
  PICKED_UP: "bg-emerald-500",
  OUT_FOR_DELIVERY: "bg-cyan-500",
  DELIVERED: "bg-emerald-500",
  SERVED: "bg-emerald-500",
  COMPLETED: "bg-emerald-600",
  CANCELED: "bg-red-400",
  REFUNDED: "bg-red-500",
};

const RANGE_LABELS: Record<ReportsRange, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
};

// ── Status breakdown bar ──────────────────────────────────────────────────────

function StatusBreakdown({ breakdown }: { breakdown: StatusBreakdownItem[] }) {
  const total = breakdown.reduce((sum, item) => sum + item.count, 0);

  if (total === 0) {
    return (
      <p className="text-sm text-slate-400">No orders in this period.</p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {breakdown.map((item) => {
          const pct = (item.count / total) * 100;
          const color = STATUS_COLORS[item.status] ?? "bg-slate-400";
          return (
            <div
              key={item.status}
              className={`${color} h-full transition-all`}
              style={{ width: `${pct}%` }}
              title={`${STATUS_LABELS[item.status] ?? item.status}: ${item.count}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {breakdown.map((item) => {
          const pct = Math.round((item.count / total) * 100);
          const color = STATUS_COLORS[item.status] ?? "bg-slate-400";
          return (
            <div key={item.status} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className={`inline-block h-2 w-2 rounded-sm ${color}`} />
              <span>{STATUS_LABELS[item.status] ?? item.status}</span>
              <span className="text-slate-400">
                {item.count} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Top items table ───────────────────────────────────────────────────────────

function TopItemsTable({ items }: { items: TopItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-400">No item data for this period.</p>
    );
  }

  const maxCount = items[0]?.count ?? 1;

  return (
    <ol className="space-y-2">
      {items.map((item, index) => {
        const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
        return (
          <li key={item.itemName} className="flex items-center gap-3">
            <span className="w-4 text-right text-xs font-medium text-slate-400 tabular-nums">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-700 truncate">
                  {item.itemName}
                </span>
                <span className="ml-2 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 tabular-nums">
                  {item.count}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReportsPage({ initialData, churchId }: ReportsPageProps) {
  const [range, setRange] = useState<ReportsRange>("today");
  const [data, setData] = useState<ReportsData>(initialData);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(
    async (selectedRange: ReportsRange) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/reports?range=${selectedRange}&churchId=${churchId}`,
        );
        if (res.ok) {
          const json: ReportsData = await res.json();
          setData(json);
        }
      } finally {
        setLoading(false);
      }
    },
    [churchId],
  );

  useEffect(() => {
    if (range !== "today") {
      fetchData(range);
    }
  }, [range, fetchData]);

  function handleRangeChange(newRange: ReportsRange) {
    setRange(newRange);
    if (newRange === "today") {
      setData(initialData);
    }
  }

  const avgOrderValue =
    data.totalOrders > 0
      ? formatCurrency(Math.round(data.revenue / data.totalOrders))
      : "$0.00";

  const completionRate =
    data.totalOrders > 0
      ? `${Math.round((data.completedOrders / data.totalOrders) * 100)}% completion`
      : undefined;

  return (
    <div className={`flex-1 overflow-y-auto bg-slate-50 p-6 ${loading ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Range selector + export */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg bg-white border border-slate-200 p-1">
          {(["today", "week", "month"] as ReportsRange[]).map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
              className={[
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                range === r
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        <a
          href={`/api/orders/export?range=${range}`}
          download
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Export CSV
        </a>
      </div>

      {/* Metric cards — 1col → 2col → 4col */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <MetricCard
          label="Total Orders"
          value={data.totalOrders.toLocaleString()}
          subtext={RANGE_LABELS[range]}
        />
        <MetricCard
          label="Completed Orders"
          value={data.completedOrders.toLocaleString()}
          subtext={completionRate}
        />
        <MetricCard
          label="Revenue"
          value={formatCurrency(data.revenue)}
          subtext="From completed orders"
        />
        <MetricCard
          label="Avg Order Value"
          value={avgOrderValue}
          subtext="All orders"
        />
      </div>

      {/* Bottom section — status breakdown + top items */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            Order Status Breakdown
          </h3>
          <StatusBreakdown breakdown={data.statusBreakdown} />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            Top Items This Week
          </h3>
          <TopItemsTable items={data.topItems} />
        </div>
      </div>
    </div>
  );
}
