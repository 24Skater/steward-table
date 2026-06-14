"use client";

import { DeliveryOrderCard } from "./delivery-order-card";
import type { DeliveryOrderCardData, DriverOption } from "./delivery-order-card";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DriversPageProps {
  orders: DeliveryOrderCardData[];
  drivers: DriverOption[];
  canAssign: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByDriver(orders: DeliveryOrderCardData[]): Map<string, DeliveryOrderCardData[]> {
  const map = new Map<string, DeliveryOrderCardData[]>();
  for (const order of orders) {
    const driverId = order.deliveryInfo?.driverId;
    if (!driverId) continue;
    const existing = map.get(driverId) ?? [];
    map.set(driverId, [...existing, order]);
  }
  return map;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center">
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
}: {
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        {count}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DriversPage({ orders, drivers, canAssign }: DriversPageProps) {
  const unassigned = orders.filter((o) => !o.deliveryInfo?.driverId);
  const assigned = orders.filter((o) => !!o.deliveryInfo?.driverId);
  const byDriver = groupByDriver(assigned);

  if (orders.length === 0) {
    return (
      <div className="flex-1 p-6">
        <EmptyState message="No delivery orders active." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left panel: unassigned */}
        <div>
          <SectionHeader title="Unassigned" count={unassigned.length} />
          {unassigned.length === 0 ? (
            <EmptyState message="All delivery orders have a driver assigned." />
          ) : (
            <div className="flex flex-col gap-3">
              {unassigned.map((order) => (
                <DeliveryOrderCard
                  key={order.id}
                  order={order}
                  drivers={drivers}
                  canAssign={canAssign}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right panel: active deliveries grouped by driver */}
        <div>
          <SectionHeader title="Active Deliveries" count={assigned.length} />
          {assigned.length === 0 ? (
            <EmptyState
              message={
                drivers.length === 0
                  ? "No drivers assigned yet. Add users with the Driver role from Team settings."
                  : "No orders are assigned to a driver yet."
              }
            />
          ) : (
            <div className="flex flex-col gap-6">
              {Array.from(byDriver.entries()).map(([driverId, driverOrders]) => {
                const driver = drivers.find((d) => d.id === driverId);
                return (
                  <div key={driverId}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {driver?.name ?? "Unknown driver"}
                    </p>
                    <div className="flex flex-col gap-3">
                      {driverOrders.map((order) => (
                        <DeliveryOrderCard
                          key={order.id}
                          order={order}
                          drivers={drivers}
                          canAssign={canAssign}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
