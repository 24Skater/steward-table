"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AlertTriangle } from "lucide-react";
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
  status: "CONFIRMED" | "IN_KITCHEN" | "READY" | "CANCELED" | "REFUNDED";
  fulfillment: "PICKUP" | "DELIVERY" | "DINE_IN";
  scheduledFor: string | null;
  createdAt: string;
  customerName: string;
  notes: string | null;
  items: KitchenOrderItem[];
}

const CANCELED_DISPLAY_MS = 30_000;

export function KitchenDisplay() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [canceledOrders, setCanceledOrders] = useState<Map<string, KitchenOrder>>(new Map());
  const [connected, setConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [markingAllReady, setMarkingAllReady] = useState(false);
  const [kitchenError, setKitchenError] = useState<string | null>(null);
  const cancelTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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

  function scheduleCanceledRemoval(orderId: string) {
    const existing = cancelTimers.current.get(orderId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setCanceledOrders((prev) => {
        const next = new Map(prev);
        next.delete(orderId);
        return next;
      });
      cancelTimers.current.delete(orderId);
    }, CANCELED_DISPLAY_MS);
    cancelTimers.current.set(orderId, timer);
  }

  // SSE connection with exponential backoff (1s, 2s, 4s, 8s, cap 30s)
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let backoffMs = 1000;

    function connect() {
      es = new EventSource("/api/sse/kitchen");

      es.onopen = () => {
        setConnected(true);
        backoffMs = 1000; // reset on successful connect
      };

      es.addEventListener("orders", (e) => {
        try {
          const data = JSON.parse(e.data) as KitchenOrder[];
          setOrders(data);
        } catch {
          // Malformed event — ignore
        }
      });

      es.addEventListener("canceled_orders", (e) => {
        try {
          const data = JSON.parse(e.data) as KitchenOrder[];
          setCanceledOrders((prev) => {
            const next = new Map(prev);
            for (const order of data) {
              if (!next.has(order.id)) {
                next.set(order.id, order);
                scheduleCanceledRemoval(order.id);
              }
            }
            return next;
          });
        } catch {
          // Ignore
        }
      });

      es.onerror = () => {
        setConnected(false);
        es?.close();
        reconnectTimeout = setTimeout(() => {
          backoffMs = Math.min(backoffMs * 2, 30_000);
          connect();
        }, backoffMs);
      };
    }

    connect();
    return () => {
      es?.close();
      clearTimeout(reconnectTimeout);
      for (const timer of cancelTimers.current.values()) {
        clearTimeout(timer);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkReady = useCallback(async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/ready`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to mark ready");
      // Optimistically remove the card — SSE will reconcile on the next poll
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
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
  const canceledList = Array.from(canceledOrders.values());
  const totalVisible = orders.length + canceledList.length;

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

      {totalVisible === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-slate-400 text-xl font-medium">No active orders</p>
            <p className="text-slate-600 text-sm">Orders will appear here automatically</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {canceledList.map((order) => (
              <CanceledOrderOverlay key={`canceled-${order.id}`} order={order} />
            ))}
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

function CanceledOrderOverlay({ order }: { order: KitchenOrder }) {
  return (
    <article
      className="flex flex-col rounded-lg border-2 border-red-500 overflow-hidden bg-slate-900 relative"
      aria-label={`Order #${order.number} CANCELED`}
    >
      {/* Red CANCELED — STOP banner */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-red-950/90 gap-3">
        <div className="text-red-300 text-4xl font-black tracking-widest animate-pulse">
          STOP
        </div>
        <div className="text-white text-lg font-bold text-center px-4">
          Order #{order.number}
        </div>
        <div className="text-red-300 text-sm font-semibold uppercase tracking-widest">
          {order.status === "REFUNDED" ? "REFUNDED" : "CANCELED"}
        </div>
      </div>

      {/* Ghost content behind overlay (gives card the right height) */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-800 opacity-30">
        <span className="text-white font-semibold text-lg">#{order.number}</span>
      </header>
      <div className="px-4 py-3 space-y-2 opacity-30">
        {order.items.map((item) => (
          <p key={item.id} className="text-white font-medium text-xl">
            {item.quantity} &times; {item.itemName}
          </p>
        ))}
      </div>
      <div className="py-5 opacity-0" style={{ minHeight: "88px" }} />
    </article>
  );
}
