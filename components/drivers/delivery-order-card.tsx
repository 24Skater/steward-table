"use client";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DriverOption {
  id: string;
  name: string | null;
}

export interface DeliveryOrderCardData {
  id: string;
  number: number;
  status: OrderStatus;
  customer: {
    name: string;
  };
  deliveryInfo: {
    id: string;
    recipientName: string;
    line1: string;
    city: string;
    driverId: string | null;
  } | null;
}

interface DeliveryOrderCardProps {
  order: DeliveryOrderCardData;
  drivers: DriverOption[];
  canAssign: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DeliveryOrderCard({ order, drivers, canAssign }: DeliveryOrderCardProps) {
  const router = useRouter();
  const [selectedDriverId, setSelectedDriverId] = useState<string>(
    order.deliveryInfo?.driverId ?? "",
  );
  const [inFlight, setInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUnassigned = !order.deliveryInfo?.driverId;

  async function handleAssign(driverId: string) {
    if (inFlight) return;
    setError(null);
    setInFlight(true);
    setSelectedDriverId(driverId);

    try {
      const res = await fetch("/api/drivers/assign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          driverId: driverId === "" ? null : driverId,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Failed to assign driver");
        // Revert to original value on error
        setSelectedDriverId(order.deliveryInfo?.driverId ?? "");
      } else {
        // Refresh to reflect the new assignment across both panels
        router.refresh();
      }
    } catch {
      setError("Network error");
      setSelectedDriverId(order.deliveryInfo?.driverId ?? "");
    } finally {
      setInFlight(false);
    }
  }

  const recipientLine = order.deliveryInfo
    ? `${order.deliveryInfo.recipientName}`
    : order.customer.name;

  const addressLine = order.deliveryInfo
    ? `${order.deliveryInfo.line1}, ${order.deliveryInfo.city}`
    : null;

  return (
    <div
      className={[
        "rounded-lg border bg-white p-4 flex flex-col gap-3",
        isUnassigned ? "border-l-4 border-l-amber-400 border-slate-200" : "border-slate-200",
      ].join(" ")}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono font-semibold text-slate-800 tabular-nums text-sm">
          #{order.number}
        </span>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Recipient */}
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-slate-800">{recipientLine}</p>
        {addressLine && <p className="text-xs text-slate-500 truncate">{addressLine}</p>}
      </div>

      {/* Driver assignment */}
      {canAssign ? (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Assigned driver</label>
          <select
            value={selectedDriverId}
            disabled={inFlight}
            onChange={(e) => handleAssign(e.target.value)}
            className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          >
            <option value="">Unassigned</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name ?? d.id}
              </option>
            ))}
          </select>
          {inFlight && <p className="text-xs text-slate-400">Saving…</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : order.deliveryInfo?.driverId ? (
        <Badge
          variant="outline"
          className="w-fit text-xs bg-slate-50 text-slate-600 border-slate-200"
        >
          {drivers.find((d) => d.id === order.deliveryInfo?.driverId)?.name ?? "Driver assigned"}
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="w-fit text-xs bg-amber-50 text-amber-700 border-amber-200"
        >
          Unassigned
        </Badge>
      )}
    </div>
  );
}
