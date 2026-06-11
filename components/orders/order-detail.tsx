"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge } from "./order-status-badge";
import { getNextStep, FULFILLMENT_LABELS, formatOrderTime } from "./order-utils";
import type { OrderStatus, FulfillmentType } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItemData {
  id: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  total: number;
  modifierSnapshot: unknown;
}

interface CustomerData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface DeliveryInfoData {
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  instructions: string | null;
}

interface OrderEventData {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string | null;
  actorId: string | null;
  createdAt: Date;
  actor: { name: string | null } | null;
}

export interface OrderDetailData {
  id: string;
  number: number;
  status: OrderStatus;
  fulfillment: FulfillmentType;
  channel: string;
  currency: string;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  notes: string | null;
  scheduledFor: Date | null;
  createdAt: Date;
  customer: CustomerData;
  items: OrderItemData[];
  events: OrderEventData[];
  deliveryInfo: DeliveryInfoData | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  actorId: string | null;
  createdAt: Date;
  actor: { name: string | null } | null;
}

interface OrderDetailProps {
  order: OrderDetailData;
  auditLogs: AuditLogEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function parseModifiers(snapshot: unknown): Array<{ name: string; choice: string; priceDelta?: number }> {
  if (!snapshot || typeof snapshot !== "object") return [];
  if (!Array.isArray(snapshot)) return [];
  return snapshot.filter(
    (m): m is { name: string; choice: string; priceDelta?: number } =>
      typeof m === "object" && m !== null && "name" in m && "choice" in m,
  );
}

function formatEventDescription(event: OrderEventData): string {
  const from = event.fromStatus;
  const to = event.toStatus;
  if (!from) return `Order created with status: ${to}`;
  return `${formatStatus(from)} → ${formatStatus(to)}${event.reason ? ` (${event.reason})` : ""}`;
}

function formatStatus(status: OrderStatus): string {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
      {children}
    </h3>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-5 ${className}`}>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OrderDetail({ order, auditLogs }: OrderDetailProps) {
  const [inFlight, setInFlight] = useState(false);
  const nextStep = getNextStep(order.status, order.fulfillment);
  const displayTime = order.scheduledFor ?? order.createdAt;

  async function handleNextStep() {
    if (!nextStep || inFlight) return;
    setInFlight(true);
    try {
      await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStep.targetStatus }),
      });
      window.location.reload();
    } catch {
      setInFlight(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        {/* Back link */}
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-3"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8.5 2.5L4 7l4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to orders
        </Link>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono font-bold text-2xl text-slate-800 tabular-nums">
              #{order.number}
            </span>
            <OrderStatusBadge status={order.status} />
            <Badge
              variant="outline"
              className="text-xs text-slate-500 border-slate-200"
            >
              {FULFILLMENT_LABELS[order.fulfillment]}
            </Badge>
            <span className="text-sm text-slate-400">
              {formatOrderTime(displayTime)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {nextStep && !inFlight ? (
              <Button
                size="sm"
                onClick={handleNextStep}
                className="h-8 px-3 text-sm"
              >
                {nextStep.label}
              </Button>
            ) : inFlight ? (
              <span className="text-sm text-slate-400">Updating…</span>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-sm"
              onClick={() => window.open(`/orders/${order.id}/print`, "_blank")}
            >
              Print receipt
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column: order contents (2/3 width on large screens) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Items */}
            <Card>
              <SectionHeading>Order Items</SectionHeading>
              <div className="flex flex-col divide-y divide-slate-100">
                {order.items.map((item) => {
                  const modifiers = parseModifiers(item.modifierSnapshot);
                  return (
                    <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium text-slate-800">
                              {item.itemName}
                            </span>
                            <span className="text-xs text-slate-400 tabular-nums">
                              x{item.quantity}
                            </span>
                          </div>

                          {modifiers.length > 0 && (
                            <ul className="mt-1 ml-3 flex flex-col gap-0.5">
                              {modifiers.map((mod, i) => (
                                <li
                                  key={i}
                                  className="text-xs text-slate-500 flex items-baseline gap-1"
                                >
                                  <span className="text-slate-400">{mod.name}:</span>
                                  <span>{mod.choice}</span>
                                  {mod.priceDelta != null && mod.priceDelta !== 0 && (
                                    <span className="text-slate-400">
                                      ({mod.priceDelta > 0 ? "+" : ""}
                                      {formatPrice(mod.priceDelta)})
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm text-slate-700 tabular-nums">
                            {formatPrice(item.total)}
                          </div>
                          {item.quantity > 1 && (
                            <div className="text-xs text-slate-400 tabular-nums">
                              {formatPrice(item.unitPrice)} each
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-1">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatPrice(order.subtotal)}</span>
                </div>
                {order.tax > 0 && (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Tax</span>
                    <span className="tabular-nums">{formatPrice(order.tax)}</span>
                  </div>
                )}
                {order.tip > 0 && (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Tip</span>
                    <span className="tabular-nums">{formatPrice(order.tip)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold text-slate-800 pt-1 border-t border-slate-100 mt-1">
                  <span>Total</span>
                  <span className="tabular-nums">{formatPrice(order.total)}</span>
                </div>
              </div>
            </Card>

            {/* Customer note */}
            {order.notes && (
              <Card>
                <SectionHeading>Order Note</SectionHeading>
                <p className="text-sm text-slate-700 leading-relaxed">{order.notes}</p>
              </Card>
            )}
          </div>

          {/* Right column: customer & fulfillment */}
          <div className="flex flex-col gap-6">
            {/* Customer */}
            <Card>
              <SectionHeading>Customer</SectionHeading>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium text-slate-800">
                  {order.customer.name}
                </p>
                {order.customer.phone && (
                  <p className="text-sm text-slate-600">{order.customer.phone}</p>
                )}
                {order.customer.email && (
                  <p className="text-sm text-slate-600">{order.customer.email}</p>
                )}
              </div>
            </Card>

            {/* Fulfillment */}
            <Card>
              <SectionHeading>Fulfillment</SectionHeading>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Type</span>
                  <Badge
                    variant="outline"
                    className="text-xs text-slate-600 border-slate-200"
                  >
                    {FULFILLMENT_LABELS[order.fulfillment]}
                  </Badge>
                </div>

                {order.scheduledFor && (
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Scheduled for</p>
                    <p className="text-sm text-slate-800">
                      {formatOrderTime(order.scheduledFor)}
                    </p>
                  </div>
                )}

                {order.fulfillment === "DELIVERY" && order.deliveryInfo && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Delivery address</p>
                    <address className="not-italic text-sm text-slate-700 leading-relaxed">
                      <span className="font-medium">{order.deliveryInfo.recipientName}</span>
                      <br />
                      {order.deliveryInfo.line1}
                      {order.deliveryInfo.line2 && (
                        <>
                          <br />
                          {order.deliveryInfo.line2}
                        </>
                      )}
                      <br />
                      {order.deliveryInfo.city}, {order.deliveryInfo.region}{" "}
                      {order.deliveryInfo.postalCode}
                    </address>
                    {order.deliveryInfo.instructions && (
                      <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                        <span className="font-medium">Instructions: </span>
                        {order.deliveryInfo.instructions}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-6">
          <Card>
            <SectionHeading>Timeline</SectionHeading>
            <OrderTimeline order={order} auditLogs={auditLogs} />
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

interface OrderTimelineProps {
  order: OrderDetailData;
  auditLogs: AuditLogEntry[];
}

function OrderTimeline({ order, auditLogs }: OrderTimelineProps) {
  const hasEvents = order.events.length > 0;

  if (!hasEvents && auditLogs.length === 0) {
    return (
      <div className="flex items-center gap-3">
        <TimelineDot />
        <div>
          <p className="text-sm text-slate-700">Order created</p>
          <p className="text-xs text-slate-400 tabular-nums mt-0.5">
            {formatOrderTime(order.createdAt)}
          </p>
        </div>
      </div>
    );
  }

  // Build a unified list sorted by createdAt ascending
  type TimelineEntry =
    | { kind: "event"; data: OrderEventData }
    | { kind: "audit"; data: AuditLogEntry };

  const entries: TimelineEntry[] = [
    ...order.events.map((e): TimelineEntry => ({ kind: "event", data: e })),
    ...auditLogs.map((a): TimelineEntry => ({ kind: "audit", data: a })),
  ].sort((a, b) => {
    const aTime = new Date(a.data.createdAt).getTime();
    const bTime = new Date(b.data.createdAt).getTime();
    return aTime - bTime;
  });

  return (
    <ol className="flex flex-col gap-0">
      {entries.map((entry, idx) => {
        const isLast = idx === entries.length - 1;

        if (entry.kind === "event") {
          const event = entry.data;
          const actor = event.actor?.name ?? (event.actorId ? "Staff" : "System");
          return (
            <TimelineItem
              key={`event-${event.id}`}
              isLast={isLast}
              timestamp={event.createdAt}
              actor={actor}
              description={formatEventDescription(event)}
            />
          );
        }

        const log = entry.data;
        const actor = log.actor?.name ?? (log.actorId ? "Staff" : "System");
        return (
          <TimelineItem
            key={`audit-${log.id}`}
            isLast={isLast}
            timestamp={log.createdAt}
            actor={actor}
            description={log.action}
          />
        );
      })}
    </ol>
  );
}

function TimelineDot() {
  return (
    <div className="w-2.5 h-2.5 rounded-full border-2 border-slate-300 bg-white shrink-0" />
  );
}

interface TimelineItemProps {
  isLast: boolean;
  timestamp: Date;
  actor: string;
  description: string;
}

function TimelineItem({ isLast, timestamp, actor, description }: TimelineItemProps) {
  return (
    <li className="flex gap-3">
      {/* Connector */}
      <div className="flex flex-col items-center">
        <TimelineDot />
        {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1 mb-0" />}
      </div>

      {/* Content */}
      <div className={`pb-4 ${isLast ? "" : ""}`}>
        <p className="text-sm text-slate-700">{description}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          <span className="tabular-nums">{formatOrderTime(new Date(timestamp))}</span>
          <span className="mx-1">&middot;</span>
          <span>{actor}</span>
        </p>
      </div>
    </li>
  );
}
