"use client";

import { Wifi, WifiOff, Printer } from "lucide-react";

interface KitchenTopBarProps {
  orderCount: number;
  currentTime: Date;
  connected: boolean;
  inKitchenCount: number;
  onMarkAllReady: () => void;
  markingAllReady: boolean;
}

export function KitchenTopBar({
  orderCount,
  currentTime,
  connected,
  inKitchenCount,
  onMarkAllReady,
  markingAllReady,
}: KitchenTopBarProps) {
  const timeStr = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <header className="flex items-center justify-between px-4 h-12 bg-slate-900 border-b border-slate-800 shrink-0">
      {/* Left: brand + connection indicator */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-slate-400 text-sm font-medium whitespace-nowrap">Steward Table</span>
        {connected ? (
          <Wifi size={14} className="text-emerald-500 shrink-0" aria-label="Connected" />
        ) : (
          <WifiOff size={14} className="text-red-400 shrink-0" aria-label="Disconnected" />
        )}
      </div>

      {/* Center: clock */}
      <time
        className="text-white text-2xl font-semibold tabular-nums"
        dateTime={currentTime.toISOString()}
      >
        {timeStr}
      </time>

      {/* Right: order count + actions */}
      <div className="flex items-center gap-3">
        <span className="text-slate-300 text-sm font-medium tabular-nums">
          {orderCount} {orderCount === 1 ? "order" : "orders"}
        </span>

        {inKitchenCount >= 2 && (
          <button
            type="button"
            onClick={onMarkAllReady}
            disabled={markingAllReady}
            className={`px-3 py-1 rounded text-sm font-semibold transition-colors
              ${
                markingAllReady
                  ? "bg-slate-700 text-slate-400 cursor-wait"
                  : "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white"
              }`}
            aria-label={`Mark all ${inKitchenCount} in-kitchen orders as ready`}
          >
            {markingAllReady ? "Marking..." : `Mark All Ready (${inKitchenCount})`}
          </button>
        )}

        <a
          href="/kitchen/print"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-medium text-slate-400
            hover:text-slate-200 hover:bg-slate-800 transition-colors"
          aria-label="Print all active orders"
          title="Print all active orders"
        >
          <Printer size={14} aria-hidden />
          <span className="hidden sm:inline">Print All</span>
        </a>
      </div>
    </header>
  );
}
