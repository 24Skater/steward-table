"use client";

import { useTransition } from "react";
import type { KitchenOrder } from "./kitchen-display";

interface UrgencyLevel {
  urgent: boolean;
  border: string;
  header: string;
  badge?: string;
}

interface UrgencyConfig {
  urgent: boolean;
  border: string;
  header: string;
  badge?: string;
}

function getUrgency(order: KitchenOrder, now: Date): UrgencyConfig {
  const referenceTime = order.scheduledFor
    ? new Date(order.scheduledFor)
    : new Date(order.createdAt);

  const diffMs = referenceTime.getTime() - now.getTime();
  const diffMin = diffMs / 60_000;

  if (diffMin <= 10) {
    return {
      urgent: true,
      border: "border-red-500",
      header: "bg-red-950",
      badge: "bg-red-500 text-white",
    };
  }
  if (diffMin <= 60) {
    return {
      urgent: false,
      border: "border-amber-400",
      header: "bg-amber-950",
      badge: "bg-amber-400 text-slate-900",
    };
  }
  return {
    urgent: false,
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

function printOrder(order: KitchenOrder) {
  const win = window.open("", "_blank", "width=400,height=560");
  if (!win) return;

  const label = fulfillmentLabel(order.fulfillment);
  const time = new Date(order.scheduledFor ?? order.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemsHtml = order.items
    .map((item) => {
      const modsHtml = Array.isArray(item.modifierSnapshot)
        ? item.modifierSnapshot
            .flatMap((g) =>
              g.options.map((o) => `<div class="mod">+ ${o.name}</div>`),
            )
            .join("")
        : "";
      return `<div class="item"><strong>${item.quantity}&times; ${item.itemName}</strong>${modsHtml}</div>`;
    })
    .join("");

  const noteHtml = order.notes
    ? `<div class="note">&#9888; ${order.notes}</div>`
    : "";

  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Order #${order.number}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:monospace;margin:0;padding:12px;width:80mm;font-size:14px}
  h1{font-size:36px;font-weight:900;text-align:center;margin:0 0 2px}
  .fulfillment{font-size:18px;font-weight:bold;text-align:center;text-transform:uppercase;margin-bottom:8px}
  hr{border:none;border-top:1px dashed #000;margin:8px 0}
  .customer{margin-bottom:2px}
  .item{margin:6px 0}
  .mod{padding-left:14px;font-size:12px}
  .note{border:2px solid #000;padding:4px 6px;margin:6px 0;font-size:13px}
  .time{text-align:center;font-size:12px;margin-top:8px}
  @media print{body{margin:0}}
</style></head>
<body>
<h1>#${order.number}</h1>
<div class="fulfillment">${label}</div>
<hr>
<div class="customer">For: <strong>${order.customerName}</strong></div>
<hr>
${itemsHtml}
${noteHtml}
<hr>
<div class="time">${time}</div>
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 250);
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

  function handlePrint() {
    printOrder(order);
  }

  function handleMarkReady() {
    printOrder(order);
    startTransition(async () => {
      await onMarkReady(order.id);
    });
  }

  return (
    <article
      className={`flex flex-col rounded-lg border-2 overflow-hidden bg-slate-900 ${urgency.border}${urgency.urgent ? " animate-pulse-subtle" : ""}`}
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
              {Array.isArray(item.modifierSnapshot) && item.modifierSnapshot.map((group) => (
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

        {/* Print + Mark ready row */}
        <div className="flex">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 transition-colors border-r border-slate-700"
            aria-label={`Print order #${order.number}`}
            title="Print"
            style={{ minHeight: "88px", minWidth: "72px" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            <span className="sr-only">Print</span>
          </button>
          <button
            type="button"
            onClick={handleMarkReady}
            disabled={isPending || order.status === "READY"}
            className={`flex-1 py-5 text-lg font-bold tracking-wide transition-colors
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
      </div>
    </article>
  );
}
