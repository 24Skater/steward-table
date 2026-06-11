"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { KitchenOrderCard } from "./kitchen-order-card";
import { KitchenTopBar } from "./kitchen-top-bar";
import {
  KitchenFilters,
  applyFilters,
  type StatusFilter,
  type FulfillmentFilter,
} from "./kitchen-filters";

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL_ACTIVE");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>("ALL");
  const [markingAllReady, setMarkingAllReady] = useState(false);
  const [kitchenError, setKitchenError] = useState<string | null>(null);

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
      setKitchenError("Could not mark order ready. Please try again.");
      setTimeout(() => setKitchenError(null), 4000);
    }
  }, []);

  const handleMarkAllReady = useCallback(async () => {
    const inKitchenIds = orders
      .filter((o) => o.status === "IN_KITCHEN")
      .map((o) => o.id);

    if (inKitchenIds.length === 0) return;

    setMarkingAllReady(true);
    try {
      await fetch("/api/orders/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: inKitchenIds, targetStatus: "READY" }),
      });
    } catch {
      setKitchenError("Could not mark all orders ready. Please try again.");
      setTimeout(() => setKitchenError(null), 4000);
    } finally {
      setMarkingAllReady(false);
    }
  }, [orders]);

  const inKitchenCount = orders.filter((o) => o.status === "IN_KITCHEN").length;
  const visibleOrders = applyFilters(orders, statusFilter, fulfillmentFilter);

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {kitchenError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-red-900/90 px-4 py-2.5 text-sm text-red-100 shadow-xl">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {kitchenError}
        </div>
      )}
      <KitchenTopBar
        orderCount={orders.length}
        currentTime={currentTime}
        connected={connected}
        inKitchenCount={inKitchenCount}
        onMarkAllReady={handleMarkAllReady}
        markingAllReady={markingAllReady}
      />

      <KitchenFilters
        orders={orders}
        statusFilter={statusFilter}
        fulfillmentFilter={fulfillmentFilter}
        onStatusChange={setStatusFilter}
        onFulfillmentChange={setFulfillmentFilter}
      />

      {visibleOrders.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-slate-400 text-xl font-medium">
              {orders.length === 0 ? "No active orders" : "No orders match the current filters"}
            </p>
            <p className="text-slate-600 text-sm">
              {orders.length === 0
                ? "Orders will appear here automatically"
                : "Try adjusting the status or fulfillment filters"}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleOrders.map((order) => (
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
