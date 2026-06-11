"use client";

import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { FulfillmentType, OrderStatus } from "@prisma/client";
import { useEffect, useState } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  totalOrders: number;
  lifetimeValueCents: number;
  lastOrderAt: Date | null;
}

interface OrderHistoryItem {
  id: string;
  number: number;
  status: OrderStatus;
  fulfillment: FulfillmentType;
  createdAt: string;
  total: number;
  _count: { items: number };
}

interface CustomerDetailDrawerProps {
  customer: CustomerRow | null;
  open: boolean;
  onClose: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateStr));
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-600 border-slate-200" },
  SUBMITTED: { label: "Submitted", className: "bg-slate-100 text-slate-700 border-slate-200" },
  CONFIRMED: { label: "Confirmed", className: "bg-blue-50 text-blue-700 border-blue-200" },
  IN_KITCHEN: { label: "In Kitchen", className: "bg-amber-50 text-amber-700 border-amber-200" },
  READY: { label: "Ready", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  AWAITING_PICKUP: {
    label: "Awaiting Pickup",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  PICKED_UP: { label: "Picked Up", className: "bg-green-50 text-green-700 border-green-200" },
  OUT_FOR_DELIVERY: {
    label: "Out for Delivery",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  DELIVERED: { label: "Delivered", className: "bg-green-50 text-green-700 border-green-200" },
  SERVED: { label: "Served", className: "bg-green-50 text-green-700 border-green-200" },
  COMPLETED: { label: "Completed", className: "bg-green-50 text-green-700 border-green-200" },
  CANCELED: { label: "Canceled", className: "bg-red-50 text-red-700 border-red-200" },
  REFUNDED: { label: "Refunded", className: "bg-red-50 text-red-600 border-red-200" },
};

const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  PICKUP: "Pickup",
  DELIVERY: "Delivery",
  DINE_IN: "Dine-in",
};

// ── Component ────────────────────────────────────────────────────────────────

export function CustomerDetailDrawer({ customer, open, onClose }: CustomerDetailDrawerProps) {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !customer) return;

    let cancelled = false;
    setOrders([]);
    setError(null);
    setLoading(true);

    fetch(`/api/customers/${customer.id}/orders`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Failed to load orders");
        }
        return res.json() as Promise<OrderHistoryItem[]>;
      })
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load orders");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, customer]);

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {customer && (
          <>
            <SheetHeader className="pb-4 border-b border-slate-100">
              <SheetTitle className="text-slate-800">{customer.name}</SheetTitle>
              <div className="flex flex-col gap-1 pt-1">
                {customer.phone && <p className="text-sm text-slate-600">{customer.phone}</p>}
                {customer.email && <p className="text-sm text-slate-600">{customer.email}</p>}
                <div className="flex items-center gap-4 pt-1">
                  <span className="text-xs text-slate-400">
                    {customer.totalOrders} order{customer.totalOrders !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-slate-400">
                    Lifetime: {formatCents(customer.lifetimeValueCents)}
                  </span>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-4">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                Order History
              </h3>

              {loading && (
                <p className="text-sm text-slate-400 py-8 text-center">Loading orders...</p>
              )}

              {error && !loading && (
                <p className="text-sm text-red-500 py-4 text-center">{error}</p>
              )}

              {!loading && !error && orders.length === 0 && (
                <p className="text-sm text-slate-400 py-8 text-center">No orders found.</p>
              )}

              {!loading && !error && orders.length > 0 && (
                <div className="flex flex-col gap-2">
                  {orders.map((order) => {
                    const statusCfg = STATUS_CONFIG[order.status] ?? {
                      label: order.status,
                      className: "bg-slate-100 text-slate-600 border-slate-200",
                    };
                    return (
                      <div
                        key={order.id}
                        className="rounded-lg border border-slate-200 bg-white p-3 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-slate-800 text-sm tabular-nums">
                            #{order.number}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium whitespace-nowrap ${statusCfg.className}`}
                          >
                            {statusCfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{formatDate(order.createdAt)}</span>
                          <span>&middot;</span>
                          <span>
                            {order._count.items} item{order._count.items !== 1 ? "s" : ""}
                          </span>
                          <span>&middot;</span>
                          <span>{FULFILLMENT_LABELS[order.fulfillment]}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-700">
                          {formatCents(order.total)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
