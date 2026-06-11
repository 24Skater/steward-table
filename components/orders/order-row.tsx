"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "./order-status-badge";
import { getNextStep, FULFILLMENT_LABELS, formatOrderTime } from "./order-utils";
import type { OrderStatus, FulfillmentType } from "@prisma/client";

export interface OrderRowData {
  id: string;
  number: number;
  status: OrderStatus;
  fulfillment: FulfillmentType;
  createdAt: Date;
  scheduledFor: Date | null;
  total: number;
  customer: { name: string };
  _count: { items: number };
}

interface OrderRowProps {
  order: OrderRowData;
}

/**
 * Renders the data cells (<td>) for a single order row.
 * The parent component is responsible for rendering the wrapping <tr> and any
 * additional columns (e.g. the bulk-selection checkbox column).
 */
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function OrderRow({ order }: OrderRowProps) {
  const router = useRouter();
  const [inFlight, setInFlight] = useState(false);
  const nextStep = getNextStep(order.status, order.fulfillment);
  const displayTime = order.scheduledFor ?? order.createdAt;
  const isFutureScheduled =
    order.scheduledFor !== null && order.scheduledFor > new Date();

  async function handleNextStep() {
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
    <>
      {/* Order # */}
      <td className="py-3 pr-3">
        <span className="font-mono font-semibold text-slate-800 tabular-nums text-sm">
          #{order.number}
        </span>
      </td>

      {/* Customer */}
      <td className="py-3 px-3">
        <span className="text-sm text-slate-700">{order.customer.name}</span>
      </td>

      {/* Items */}
      <td className="py-3 px-3 text-center">
        <span className="text-sm text-slate-500 tabular-nums">
          {order._count.items}
        </span>
      </td>

      {/* Fulfillment */}
      <td className="py-3 px-3">
        <span className="text-sm text-slate-500">
          {FULFILLMENT_LABELS[order.fulfillment]}
        </span>
      </td>

      {/* Status */}
      <td className="py-3 px-3">
        <OrderStatusBadge status={order.status} />
      </td>

      {/* Total */}
      <td className="py-3 px-3 text-right">
        <span className="text-sm font-medium text-slate-700 tabular-nums">
          {formatCents(order.total)}
        </span>
      </td>

      {/* Time */}
      <td className="py-3 px-3">
        <span
          className={[
            "text-xs tabular-nums whitespace-nowrap",
            isFutureScheduled ? "text-amber-500 font-medium" : "text-slate-400",
          ].join(" ")}
        >
          {formatOrderTime(displayTime)}
        </span>
      </td>

      {/* Next step */}
      <td className="py-3 pl-3 pr-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/orders/${order.id}`}
            className="text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline transition-colors"
          >
            View
          </Link>
          {nextStep && !inFlight ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleNextStep}
              className="text-xs h-7 px-2.5"
            >
              {nextStep.label}
            </Button>
          ) : inFlight ? (
            <span className="text-xs text-slate-400">Updating…</span>
          ) : null}
        </div>
      </td>
    </>
  );
}
