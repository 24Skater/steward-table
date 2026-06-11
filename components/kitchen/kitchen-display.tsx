"use client";

import { useEffect, useState, useCallback } from "react";
import { KitchenOrderCard } from "./kitchen-order-card";
import { KitchenTopBar } from "./kitchen-top-bar";

export interface KitchenOrderItem {
  id: string;
  itemName: string;
  quantity: number;
  modifierSnapshot: Array<{
    groupName: string;
    options: Array<{ name: string; priceDelta: number }>;
  }>;
}

export interface KitchenOrder {
  id: string;
  number: number;
  status: "CONFIRMED" | "IN_KITCHEN" | "READY";
  fulfillment: "PICKUP" | "DELIVERY" | "DINE_IN";
  scheduledFor: string | null;
  createdAt: string;
  customerName: string;
  notes: string | null;
  items: KitchenOrderItem[];
}

export function KitchenDisplay() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [connected, setConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Wakelock: keep screen awake on kitchen tablet
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    async function acquireWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch {
        // WakeLock not supported or denied — continue without it
      }
    }

    acquireWakeLock();

    // Re-acquire on visibility change (browser releases lock when tab is hidden)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      wakeLock?.release();
    };
  }, []);

  // Clock tick
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // SSE connection for real-time order updates
  useEffect(() => {
    let es: EventSource;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource("/api/sse/kitchen");

      es.onopen = () => setConnected(true);

      es.addEventListener("orders", (e) => {
        try {
          const data = JSON.parse(e.data) as KitchenOrder[];
          setOrders(data);
        } catch {
          // Malformed event — ignore
        }
      });

      es.addEventListener("order_update", (e) => {
        try {
          const updated = JSON.parse(e.data) as KitchenOrder;
          setOrders((prev) => {
            // Remove completed/canceled orders, update or add active ones
            const activeStatuses = new Set(["CONFIRMED", "IN_KITCHEN", "READY"]);
            if (!activeStatuses.has(updated.status)) {
              return prev.filter((o) => o.id !== updated.id);
            }
            const idx = prev.findIndex((o) => o.id === updated.id);
            if (idx === -1) return [...prev, updated];
            const next = [...prev];
            next[idx] = updated;
            return next;
          });
        } catch {
          // Ignore
        }
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        reconnectTimeout = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      es.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  const handleMarkReady = useCallback(async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/ready`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to mark ready");
    } catch {
      // TODO: Show error toast
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      <KitchenTopBar
        orderCount={orders.length}
        currentTime={currentTime}
        connected={connected}
      />

      {orders.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-slate-400 text-xl font-medium">No active orders</p>
            <p className="text-slate-600 text-sm">Orders will appear here automatically</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {orders.map((order) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                currentTime={currentTime}
                onMarkReady={handleMarkReady}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
