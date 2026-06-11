"use client";

import { Wifi, WifiOff } from "lucide-react";

interface KitchenTopBarProps {
  orderCount: number;
  currentTime: Date;
  connected: boolean;
}

export function KitchenTopBar({ orderCount, currentTime, connected }: KitchenTopBarProps) {
  const timeStr = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <header className="flex items-center justify-between px-4 h-12 bg-slate-900 border-b border-slate-800 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm font-medium">Steward Table</span>
        {connected ? (
          <Wifi size={14} className="text-emerald-500" aria-label="Connected" />
        ) : (
          <WifiOff size={14} className="text-red-400" aria-label="Disconnected" />
        )}
      </div>

      <time
        className="text-white text-2xl font-semibold tabular-nums"
        dateTime={currentTime.toISOString()}
      >
        {timeStr}
      </time>

      <span className="text-slate-300 text-sm font-medium tabular-nums">
        {orderCount} {orderCount === 1 ? "order" : "orders"}
      </span>
    </header>
  );
}
