"use client";

import type { OrderStatus } from "@prisma/client";
import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { DateRange } from "@/app/(dashboard)/orders/page";
import { NewOrderDialog } from "./new-order-dialog";
import { OrderRow } from "./order-row";
import type { OrderRowData } from "./order-row";
import { OrderStatusBadge } from "./order-status-badge";
import { FULFILLMENT_LABELS, formatOrderTime, getNextStep } from "./order-utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface OrdersPageProps {
  orders: OrderRowData[];
  churchId: string;
  range: DateRange;
}

type FilterTab = "all" | "pending" | "in-progress" | "completed" | "canceled" | "scheduled";

interface OrdersSsePayload {
  statusCounts: Partial<Record<OrderStatus, number>>;
  newOrders: Array<{
    id: string;
    number: number;
    customerName: string;
    status: OrderStatus;
    createdAt: string;
  }>;
}

// ── SSE hook ──────────────────────────────────────────────────────────────────

function useOrdersSse() {
  const [liveStatusCounts, setLiveStatusCounts] = useState<Partial<Record<OrderStatus, number>>>({});
  const [isLive, setIsLive] = useState(false);
  // Track previous total to detect new orders arriving
  const prevTotalRef = useRef<number>(0);
  const [flashTab, setFlashTab] = useState<FilterTab | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/sse/orders");

    es.addEventListener("orders", (e: MessageEvent<string>) => {
      const payload = JSON.parse(e.data) as OrdersSsePayload;
      setIsLive(true);
      setLiveStatusCounts(payload.statusCounts);

      // Detect newly arrived orders (new orders in the last 5 minutes)
      const newTotal = payload.newOrders.length;
      if (newTotal > prevTotalRef.current) {
        // Flash the "pending" tab since new orders arrive as SUBMITTED
        setFlashTab("pending");
        setTimeout(() => setFlashTab(null), 1_500);
      }
      prevTotalRef.current = newTotal;
    });

    es.onerror = () => {
      setIsLive(false);
    };

    return () => {
      es.close();
      setIsLive(false);
    };
  }, []);

  return { liveStatusCounts, isLive, flashTab };
}

// ── Status groups ─────────────────────────────────────────────────────────────

const PENDING_STATUSES: OrderStatus[] = ["SUBMITTED", "CONFIRMED"];
const IN_PROGRESS_STATUSES: OrderStatus[] = [
  "IN_KITCHEN",
  "READY",
  "AWAITING_PICKUP",
  "OUT_FOR_DELIVERY",
];
const COMPLETED_STATUSES: OrderStatus[] = ["PICKED_UP", "DELIVERED", "SERVED", "COMPLETED"];
const CANCELED_STATUSES: OrderStatus[] = ["CANCELED", "REFUNDED"];

const TAB_LABELS: Record<FilterTab, string> = {
  all: "All",
  pending: "Pending",
  "in-progress": "In Progress",
  completed: "Completed",
  canceled: "Canceled",
  scheduled: "Scheduled",
};

// ── Bulk action config ────────────────────────────────────────────────────────

interface BulkAction {
  label: string;
  targetStatus: OrderStatus;
}

function getBulkAction(selectedOrders: OrderRowData[]): BulkAction | null {
  if (selectedOrders.length === 0) return null;
  const statuses = new Set(selectedOrders.map((o) => o.status));
  if (statuses.size === 1) {
    const status = [...statuses][0];
    if (status === "SUBMITTED") return { label: "Confirm All", targetStatus: "CONFIRMED" };
    if (status === "IN_KITCHEN") return { label: "Mark All Ready", targetStatus: "READY" };
  }
  return null;
}

// ── Date range options ────────────────────────────────────────────────────────

const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "week" },
  { label: "Last 30 days", value: "month" },
  { label: "All time", value: "all" },
  { label: "Upcoming (Scheduled)", value: "scheduled" },
];

// ── Filter helper ─────────────────────────────────────────────────────────────

function filterOrders(orders: OrderRowData[], tab: FilterTab): OrderRowData[] {
  const now = new Date();
  switch (tab) {
    case "pending":
      return orders.filter((o) => (PENDING_STATUSES as string[]).includes(o.status));
    case "in-progress":
      return orders.filter((o) => (IN_PROGRESS_STATUSES as string[]).includes(o.status));
    case "completed":
      return orders.filter((o) => (COMPLETED_STATUSES as string[]).includes(o.status));
    case "canceled":
      return orders.filter((o) => (CANCELED_STATUSES as string[]).includes(o.status));
    case "scheduled": {
      const future = orders.filter(
        (o) => o.scheduledFor !== null && o.scheduledFor > now,
      );
      return [...future].sort((a, b) => {
        const aTime = (a.scheduledFor as Date).getTime();
        const bTime = (b.scheduledFor as Date).getTime();
        return aTime - bTime;
      });
    }
    default:
      return orders;
  }
}

// ── Mobile card ───────────────────────────────────────────────────────────────

function MobileOrderCard({ order }: { order: OrderRowData }) {
  const router = useRouter();
  const [inFlight, setInFlight] = useState(false);
  const nextStep = getNextStep(order.status, order.fulfillment);
  const displayTime = order.scheduledFor ?? order.createdAt;

  async function handleNextStep(e: React.MouseEvent) {
    e.stopPropagation();
    if (!nextStep || inFlight) return;
    setInFlight(true);
    try {
      await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStep.targetStatus }),
      });
      router.refresh();
    } catch {
      setInFlight(false);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/orders/${order.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") router.push(`/orders/${order.id}`);
      }}
      className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-2 cursor-pointer hover:border-slate-300 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono font-semibold text-slate-800 tabular-nums text-sm">
          #{order.number}
        </span>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="text-sm text-slate-700">{order.customer.name}</div>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>{order._count.items} items</span>
        <span>&middot;</span>
        <span>{FULFILLMENT_LABELS[order.fulfillment]}</span>
        <span>&middot;</span>
        <span className="tabular-nums">{formatOrderTime(displayTime)}</span>
      </div>
      {nextStep && !inFlight && (
        <button
          onClick={handleNextStep}
          className="mt-1 w-full rounded-md border border-slate-200 bg-white py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          {nextStep.label}
        </button>
      )}
      {inFlight && <p className="mt-1 text-center text-xs text-slate-400">Updating…</p>}
    </div>
  );
}

// ── Export button ─────────────────────────────────────────────────────────────

interface ExportButtonProps {
  range: DateRange;
}

function ExportButton({ range }: ExportButtonProps) {
  function handleExport() {
    const url = `/api/orders/export?range=${range}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
    >
      <Download className="h-3.5 w-3.5" />
      Export CSV
    </button>
  );
}

// ── Bulk action bar ───────────────────────────────────────────────────────────

interface BulkActionBarProps {
  selectedCount: number;
  bulkAction: BulkAction | null;
  isBulkLoading: boolean;
  onBulkAction: () => void;
  onClear: () => void;
}

function BulkActionBar({
  selectedCount,
  bulkAction,
  isBulkLoading,
  onBulkAction,
  onClear,
}: BulkActionBarProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <span className="text-sm font-medium text-slate-700">
        {selectedCount} {selectedCount === 1 ? "order" : "orders"} selected
      </span>
      {bulkAction && (
        <button
          onClick={onBulkAction}
          disabled={isBulkLoading}
          className="px-3 py-1.5 rounded-md bg-slate-800 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isBulkLoading ? "Updating…" : bulkAction.label}
        </button>
      )}
      <button
        onClick={onClear}
        disabled={isBulkLoading}
        aria-label="Clear selection"
        className="text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-colors text-lg leading-none"
      >
        &times;
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function OrdersPage({ orders, churchId, range }: OrdersPageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const { liveStatusCounts, isLive, flashTab } = useOrdersSse();

  const tabFiltered = filterOrders(orders, activeTab);
  const visible = search.trim()
    ? tabFiltered.filter(
        (o) =>
          String(o.number).includes(search.trim()) ||
          o.customer.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : tabFiltered;

  const selectedOrders = visible.filter((o) => selectedIds.has(o.id));
  const bulkAction = getBulkAction(selectedOrders);
  const allVisibleSelected = visible.length > 0 && visible.every((o) => selectedIds.has(o.id));
  const someVisibleSelected = visible.some((o) => selectedIds.has(o.id));

  const tabs: FilterTab[] = ["all", "pending", "in-progress", "completed", "canceled", "scheduled"];

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(visible.map((o) => o.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function handleSelectRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  function handleRangeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`/orders?range=${e.target.value}`);
  }

  async function handleBulkAction() {
    if (!bulkAction || isBulkLoading || selectedOrders.length === 0) return;
    setIsBulkLoading(true);
    try {
      await fetch("/api/orders/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: selectedOrders.map((o) => o.id),
          targetStatus: bulkAction.targetStatus,
        }),
      });
      setSelectedIds(new Set());
      router.refresh();
    } catch {
      setIsBulkLoading(false);
    }
  }

  // Clear selection when tab or search changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab, search]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <NewOrderDialog
        open={newOrderOpen}
        onClose={() => setNewOrderOpen(false)}
        churchId={churchId}
      />

      {/* Filter tabs + search + export */}
      <div className="px-6 pt-4 pb-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white border-b border-slate-200">
        {/* Segmented control */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit overflow-x-auto">
          {tabs.map((tab) => {
            const serverCount = tab !== "all" ? filterOrders(orders, tab).length : orders.length;
            const isActive = activeTab === tab;
            const isFlashing = flashTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                {TAB_LABELS[tab]}
                <span
                  className={[
                    "ml-1.5 text-xs transition-colors duration-300",
                    isFlashing
                      ? "text-emerald-500 font-semibold"
                      : isActive
                        ? "text-slate-500"
                        : "text-slate-400",
                  ].join(" ")}
                >
                  {serverCount}
                </span>
                {/* Live count overlay dot when SSE has data */}
                {isLive && Object.keys(liveStatusCounts).length > 0 && isFlashing && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />
                )}
              </button>
            );
          })}
        </div>

        {/* Date range + Search + Export + New order */}
        <div className="pb-3 sm:pb-0 flex gap-2 items-center flex-wrap">
          {/* Date range filter */}
          <select
            value={range}
            onChange={handleRangeChange}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {DATE_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Search order # or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-56 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <ExportButton range={range} />
          {/* Live indicator */}
          {isLive && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          )}
          <button
            type="button"
            onClick={() => setNewOrderOpen(true)}
            className="px-3 py-2 rounded-md bg-slate-800 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
          >
            New order
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {visible.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-slate-400">No orders found.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block px-6 py-4">
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {/* Checkbox column */}
                      <th className="py-2.5 pl-4 pr-2 w-10">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                          }}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          aria-label="Select all orders"
                          className="h-4 w-4 rounded border-slate-300 text-slate-800 focus:ring-slate-300"
                        />
                      </th>
                      <th className="py-2.5 pr-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Order
                      </th>
                      <th className="py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Customer
                      </th>
                      <th className="py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-center">
                        Items
                      </th>
                      <th className="py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Type
                      </th>
                      <th className="py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Status
                      </th>
                      <th className="py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Time
                      </th>
                      <th className="py-2.5 pl-3 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((order) => (
                      <tr
                        key={order.id}
                        className={
                          selectedIds.has(order.id)
                            ? "border-b border-slate-100 bg-slate-50"
                            : "border-b border-slate-100"
                        }
                      >
                        {/* Checkbox */}
                        <td className="py-3 pl-4 pr-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(order.id)}
                            onChange={(e) => handleSelectRow(order.id, e.target.checked)}
                            aria-label={`Select order #${order.number}`}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-slate-300 text-slate-800 focus:ring-slate-300"
                          />
                        </td>
                        {/* Delegate remaining cells to OrderRow (rendered inline) */}
                        <OrderRow order={order} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile card stack */}
            <div className="sm:hidden px-4 py-4 flex flex-col gap-3">
              {visible.map((order) => (
                <MobileOrderCard key={order.id} order={order} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bulk action floating bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          bulkAction={bulkAction}
          isBulkLoading={isBulkLoading}
          onBulkAction={handleBulkAction}
          onClear={handleClearSelection}
        />
      )}
    </div>
  );
}
