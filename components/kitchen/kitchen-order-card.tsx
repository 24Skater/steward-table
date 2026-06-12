"use client";

import { useTransition } from "react";
import type { KitchenOrder } from "./kitchen-display";

interface UrgencyLevel {
  border: string;
  header: string;
  badge?: string;
}

function getUrgency(order: KitchenOrder, now: Date): UrgencyLevel {
  const referenceTime = order.scheduledFor
    ? new Date(order.scheduledFor)
    : new Date(order.createdAt);

  const diffMs = referenceTime.getTime() - now.getTime();
  const diffMin = diffMs / 60_000;

  if (diffMin <= 10) {
    return {
      border: "border-red-500",
      header: "bg-red-950",
      badge: "bg-red-500 text-white",
    };
  }
  if (diffMin <= 60) {
    return {
      border: "border-amber-400",
      header: "bg-amber-950",
      badge: "bg-amber-400 text-slate-900",
    };
  }
  return {
    border: "border-slate-700",
    header: "bg-slate-800",
  };
}

function formatOrderTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fulfillmentLabel(type: KitchenOrder["fulfillment"]): string {
  switch (type) {
    case "PICKUP":
      return "Pickup";
    case "DELIVERY":
      return "Delivery";
    case "DINE_IN":
      return "Dine-in";
  }
}

interface KitchenOrderCardProps {
  order: KitchenOrder;
  currentTime: Date;
  onMarkReady: (orderId: string) => Promise<void>;
}

export function KitchenOrderCard({ order, currentTime, onMarkReady }: KitchenOrderCardProps) {
  const [isPending, startTransition] = useTransition();
  const urgency = getUrgency(order, currentTime);
  const displayTime = order.scheduledFor
    ? formatOrderTime(order.scheduledFor)
    : formatOrderTime(order.createdAt);

  // "In kitchen 1h+" badge — only for IN_KITCHEN orders
  const inKitchenMs = order.status === "IN_KITCHEN"
    ? currentTime.getTime() - new Date(order.createdAt).getTime()
    : 0;
  const showStalebadge = inKitchenMs > 60 * 60 * 1000;

  function handleMarkReady() {
    startTransition(async () => {
      await onMarkReady(order.id);
    });
  }

  return (
    <article
      className={`flex flex-col rounded-lg border-2 overflow-hidden bg-slate-900 ${urgency.border}`}
      aria-label={`Order #${order.number}`}
    >
      {/* Header */}
      <header className={`flex items-center justify-between px-4 py-3 ${urgency.header}`}>
        <span className="text-white font-semibold text-lg tabular-nums">
          #{order.number}
        </span>
        <div className="flex items-center gap-2">
          {showStalebadge && (
            <span className="text-xs font-semibold bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded">
              ⏱ 1h+
            </span>
          )}
          <time className="text-slate-300 text-sm">{displayTime}</time>
        </div>
      </header>

      <div className="flex flex-col flex-1 divide-y divide-slate-800">
        {/* Items */}
        <div className="px-4 py-3 space-y-3 flex-1">
          {order.items.map((item) => (
            <div key={item.id}>
              <p className="text-white font-medium text-xl leading-tight">
                {item.quantity} &times; {item.itemName}
              </p>
              {item.modifierSnapshot.map((group) => (
                <div key={group.groupName} className="pl-4 mt-0.5">
                  {group.options.map((opt) => (
                    <p key={opt.name} className="text-slate-400 text-base leading-snug">
                      {group.groupName}: {opt.name}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Customer note */}
        {order.notes && (
          <div className="px-4 py-2 bg-yellow-950/50 border-t border-yellow-800/30">
            <p className="text-yellow-200 text-sm font-medium leading-snug">
              Note: {order.notes}
            </p>
          </div>
        )}

        {/* Customer + fulfillment */}
        <div className="px-4 py-2">
          <p className="text-slate-400 text-sm">
            For: {order.customerName} &middot; {fulfillmentLabel(order.fulfillment)}
          </p>
        </div>

        {/* Mark ready button — minimum 88px height per touch-target spec */}
        <button
          type="button"
          onClick={handleMarkReady}
          disabled={isPending || order.status === "READY"}
          className={`w-full py-5 text-lg font-bold tracking-wide transition-colors
            ${
              order.status === "READY"
                ? "bg-emerald-800 text-emerald-300 cursor-default"
                : isPending
                  ? "bg-slate-700 text-slate-400 cursor-wait"
                  : "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white"
            }`}
          style={{ minHeight: "88px" }}
          aria-label={
            order.status === "READY"
              ? "Order already marked ready"
              : `Mark order #${order.number} as ready`
          }
        >
          {order.status === "READY" ? "READY" : isPending ? "Marking..." : "MARK READY"}
        </button>
      </div>
    </article>
  );
}
