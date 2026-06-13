"use client";

import type { KitchenOrder } from "./kitchen-display";

export type StatusFilter = "ALL_ACTIVE" | "IN_KITCHEN" | "READY";
export type FulfillmentFilter = "ALL" | "PICKUP" | "DELIVERY" | "DINE_IN";

interface StatusTabProps {
  value: StatusFilter;
  current: StatusFilter;
  label: string;
  count: number;
  onClick: (v: StatusFilter) => void;
}

function StatusTab({ value, current, label, count, onClick }: StatusTabProps) {
  const isActive = value === current;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
        ${
          isActive
            ? "bg-slate-700 text-white"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        }`}
      aria-pressed={isActive}
    >
      {label}
      <span
        className={`tabular-nums text-xs px-1.5 py-0.5 rounded-full
          ${isActive ? "bg-slate-600 text-slate-200" : "bg-slate-800 text-slate-500"}`}
      >
        {count}
      </span>
    </button>
  );
}

interface FulfillmentToggleProps {
  value: FulfillmentFilter;
  current: FulfillmentFilter;
  label: string;
  onClick: (v: FulfillmentFilter) => void;
}

function FulfillmentToggle({ value, current, label, onClick }: FulfillmentToggleProps) {
  const isActive = value === current;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`px-3 py-1 rounded text-sm font-medium transition-colors
        ${
          isActive
            ? "bg-indigo-600 text-white"
            : "text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600"
        }`}
      aria-pressed={isActive}
    >
      {label}
    </button>
  );
}

function countByStatus(orders: KitchenOrder[], statuses: KitchenOrder["status"][]): number {
  return orders.filter((o) => statuses.includes(o.status)).length;
}

interface KitchenFiltersProps {
  orders: KitchenOrder[];
  statusFilter: StatusFilter;
  fulfillmentFilter: FulfillmentFilter;
  onStatusChange: (v: StatusFilter) => void;
  onFulfillmentChange: (v: FulfillmentFilter) => void;
}

export function KitchenFilters({
  orders,
  statusFilter,
  fulfillmentFilter,
  onStatusChange,
  onFulfillmentChange,
}: KitchenFiltersProps) {
  const allActiveCount = countByStatus(orders, ["CONFIRMED", "IN_KITCHEN", "READY"]);
  const inKitchenCount = countByStatus(orders, ["IN_KITCHEN"]);
  const readyCount = countByStatus(orders, ["READY"]);

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-800">
      {/* Status tabs */}
      <div className="flex items-center gap-1" role="group" aria-label="Filter by status">
        <StatusTab
          value="ALL_ACTIVE"
          current={statusFilter}
          label="All Active"
          count={allActiveCount}
          onClick={onStatusChange}
        />
        <StatusTab
          value="IN_KITCHEN"
          current={statusFilter}
          label="In Kitchen"
          count={inKitchenCount}
          onClick={onStatusChange}
        />
        <StatusTab
          value="READY"
          current={statusFilter}
          label="Ready"
          count={readyCount}
          onClick={onStatusChange}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-slate-700 hidden sm:block" aria-hidden />

      {/* Fulfillment toggles */}
      <div className="flex items-center gap-1.5" role="group" aria-label="Filter by fulfillment type">
        {(
          [
            ["ALL", "All"],
            ["PICKUP", "Pickup"],
            ["DELIVERY", "Delivery"],
            ["DINE_IN", "Dine-in"],
          ] as [FulfillmentFilter, string][]
        ).map(([value, label]) => (
          <FulfillmentToggle
            key={value}
            value={value}
            current={fulfillmentFilter}
            label={label}
            onClick={onFulfillmentChange}
          />
        ))}
      </div>
    </div>
  );
}

/** Apply the current filters to an order list. */
export function applyFilters(
  orders: KitchenOrder[],
  statusFilter: StatusFilter,
  fulfillmentFilter: FulfillmentFilter,
): KitchenOrder[] {
  let result = orders;

  if (statusFilter === "IN_KITCHEN") {
    result = result.filter((o) => o.status === "IN_KITCHEN");
  } else if (statusFilter === "READY") {
    result = result.filter((o) => o.status === "READY");
  }
  // "ALL_ACTIVE" keeps all (they're already filtered to active statuses by SSE)

  if (fulfillmentFilter !== "ALL") {
    result = result.filter((o) => o.fulfillment === fulfillmentFilter);
  }

  return result;
}
