"use client";

import type { OrderStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NewOrderDialog } from "./new-order-dialog";
import { OrderRow } from "./order-row";
import type { OrderRowData } from "./order-row";
import { OrderStatusBadge } from "./order-status-badge";
import { FULFILLMENT_LABELS, formatOrderTime, getNextStep } from "./order-utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface OrdersPageProps {
  orders: OrderRowData[];
  churchId: string;
}

type FilterTab = "all" | "pending" | "in-progress" | "completed" | "canceled";

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
};

// ── Filter helper ─────────────────────────────────────────────────────────────

function filterOrders(orders: OrderRowData[], tab: FilterTab): OrderRowData[] {
  switch (tab) {
    case "pending":
      return orders.filter((o) => (PENDING_STATUSES as string[]).includes(o.status));
    case "in-progress":
      return orders.filter((o) => (IN_PROGRESS_STATUSES as string[]).includes(o.status));
    case "completed":
      return orders.filter((o) => (COMPLETED_STATUSES as string[]).includes(o.status));
    case "canceled":
      return orders.filter((o) => (CANCELED_STATUSES as string[]).includes(o.status));
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
      window.location.reload();
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

// ── Export dropdown ───────────────────────────────────────────────────────────

type ExportRange = "today" | "week" | "month" | "all";

interface ExportOption {
  label: string;
  range: ExportRange;
}

const EXPORT_OPTIONS: ExportOption[] = [
  { label: "Today", range: "today" },
  { label: "Last 7 days", range: "week" },
  { label: "This month", range: "month" },
  { label: "All time", range: "all" },
];

function ExportDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  function handleExport(range: ExportRange) {
    const url = `/api/orders/export?range=${range}`;
    window.location.href = url;
    setIsOpen(false);
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        Export
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 rounded-md border border-slate-200 bg-white shadow-md z-10">
          {EXPORT_OPTIONS.map((option) => (
            <button
              key={option.range}
              onClick={() => handleExport(option.range)}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors first:rounded-t-md last:rounded-b-md"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function OrdersPage({ orders, churchId }: OrdersPageProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [newOrderOpen, setNewOrderOpen] = useState(false);

  const tabFiltered = filterOrders(orders, activeTab);
  const visible = search.trim()
    ? tabFiltered.filter(
        (o) =>
          String(o.number).includes(search.trim()) ||
          o.customer.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : tabFiltered;

  const tabs: FilterTab[] = ["all", "pending", "in-progress", "completed", "canceled"];

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
            const count = tab !== "all" ? filterOrders(orders, tab).length : orders.length;
            const isActive = activeTab === tab;
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
                    "ml-1.5 text-xs",
                    isActive ? "text-slate-500" : "text-slate-400",
                  ].join(" ")}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + Export + New order */}
        <div className="pb-3 sm:pb-0 flex gap-2 items-center">
          <input
            type="search"
            placeholder="Search order # or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-56 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <ExportDropdown />
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
                      <th className="py-2.5 pl-4 pr-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
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
                      <OrderRow key={order.id} order={order} />
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
    </div>
  );
}
