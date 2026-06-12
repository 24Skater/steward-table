"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AssignedDelivery, AvailableDelivery } from "@/app/(driver)/d/page";

function formatScheduled(iso: string | null): string {
  if (!iso) return "ASAP";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function buildMapsUrl(addr: string): string {
  const encoded = encodeURIComponent(addr);
  return `https://maps.google.com/?q=${encoded}`;
}

function fullAddress(info: NonNullable<AssignedDelivery["deliveryInfo"]>): string {
  const parts = [info.line1];
  if (info.line2) parts.push(info.line2);
  parts.push(`${info.city}, ${info.region} ${info.postalCode}`);
  return parts.join(", ");
}

function itemSummary(items: Array<{ itemName: string; quantity: number }>): string {
  return items.map((i) => `${i.quantity}× ${i.itemName}`).join(", ");
}

interface AssignedCardProps {
  delivery: AssignedDelivery;
  onAction: (orderId: string, status: "OUT_FOR_DELIVERY" | "DELIVERED") => Promise<void>;
  inFlight: boolean;
}

function AssignedCard({ delivery, onAction, inFlight }: AssignedCardProps) {
  const addr = delivery.deliveryInfo ? fullAddress(delivery.deliveryInfo) : null;
  const mapsUrl = addr ? buildMapsUrl(addr) : null;
  const summary = itemSummary(delivery.items);

  const isReady = delivery.status === "READY";
  const actionLabel = isReady ? "Picked up" : "Delivered";
  const nextStatus: "OUT_FOR_DELIVERY" | "DELIVERED" = isReady ? "OUT_FOR_DELIVERY" : "DELIVERED";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Status chip */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <Link
          href={`/d/${delivery.id}`}
          className="font-semibold text-slate-800 hover:underline underline-offset-2"
        >
          Order #{delivery.number}
        </Link>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            isReady
              ? "bg-yellow-100 text-yellow-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {isReady ? "Ready" : "Out for Delivery"}
        </span>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Recipient */}
        <div>
          <p className="text-base font-medium text-slate-800">
            {delivery.deliveryInfo?.recipientName ?? delivery.customerName}
          </p>
          {addr && <p className="text-sm text-slate-500 mt-0.5">{addr}</p>}
        </div>

        {/* Items */}
        {summary && (
          <p className="text-sm text-slate-600 line-clamp-2">{summary}</p>
        )}

        {/* Special instructions */}
        {delivery.deliveryInfo?.instructions && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2">
            <p className="text-sm text-yellow-900 font-medium">
              {delivery.deliveryInfo.instructions}
            </p>
          </div>
        )}

        {/* Secondary actions */}
        <div className="flex gap-2">
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
              style={{ minHeight: "48px" }}
            >
              Navigate
            </a>
          )}
          {delivery.customerPhone && (
            <a
              href={`tel:${delivery.customerPhone}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
              style={{ minHeight: "48px" }}
            >
              Call
            </a>
          )}
        </div>

        {/* Primary action */}
        <button
          type="button"
          disabled={inFlight}
          onClick={() => onAction(delivery.id, nextStatus)}
          className={`w-full font-bold text-white rounded-lg transition-colors disabled:opacity-60 ${
            isReady
              ? "bg-slate-800 hover:bg-slate-700 active:bg-slate-900"
              : "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700"
          }`}
          style={{ minHeight: "64px", fontSize: "1rem" }}
        >
          {inFlight ? "Updating…" : actionLabel}
        </button>
      </div>
    </div>
  );
}

interface AvailableCardProps {
  delivery: AvailableDelivery;
  onClaim: (orderId: string) => Promise<"claimed" | "taken">;
}

function AvailableCard({ delivery, onClaim }: AvailableCardProps) {
  const [state, setState] = useState<"idle" | "claiming" | "taken">("idle");

  async function handleClaim() {
    if (state !== "idle") return;
    setState("claiming");
    const result = await onClaim(delivery.id);
    if (result === "taken") {
      setState("taken");
      // Auto-reset after 3 seconds so the card can be removed by refresh
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-opacity ${
        state === "taken" ? "opacity-60" : ""
      } ${state === "taken" ? "border-rose-200" : "border-slate-200"}`}
    >
      <div className="flex items-start justify-between px-4 pt-4 pb-2">
        <span className="font-semibold text-slate-800">
          Order #{delivery.number}
          {delivery.city ? ` · ${delivery.city}` : ""}
        </span>
        <span className="text-xs text-slate-400">
          {formatScheduled(delivery.scheduledFor)}
        </span>
      </div>

      <div className="px-4 pb-4 space-y-3">
        <p className="text-sm text-slate-500">
          {delivery.itemCount} {delivery.itemCount === 1 ? "item" : "items"}
        </p>

        {state === "taken" ? (
          <div className="py-3 text-center text-sm text-rose-600 font-medium">
            Order #{delivery.number} was claimed by someone else
          </div>
        ) : (
          <button
            type="button"
            disabled={state === "claiming"}
            onClick={handleClaim}
            className="w-full font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 active:bg-emerald-200 transition-colors disabled:opacity-60"
            style={{ minHeight: "64px", fontSize: "1rem" }}
          >
            {state === "claiming" ? "Claiming…" : "Claim"}
          </button>
        )}
      </div>
    </div>
  );
}

interface DriverHomeProps {
  assigned: AssignedDelivery[];
  available: AvailableDelivery[];
}

export function DriverHome({ assigned, available }: DriverHomeProps) {
  const router = useRouter();
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleDeliver(orderId: string, status: "OUT_FOR_DELIVERY" | "DELIVERED") {
    if (actionInFlight) return;
    setActionInFlight(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        showToast("Couldn't update — try again when you have signal.");
      } else {
        router.refresh();
      }
    } catch {
      showToast("Couldn't update — try again when you have signal.");
    } finally {
      setActionInFlight(null);
    }
  }

  async function handleClaim(orderId: string): Promise<"claimed" | "taken"> {
    try {
      const res = await fetch(`/api/orders/${orderId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.status === 409) {
        return "taken";
      }
      if (!res.ok) {
        showToast("Couldn't claim — try again.");
        return "taken";
      }
      router.refresh();
      return "claimed";
    } catch {
      showToast("Couldn't claim — try again when you have signal.");
      return "taken";
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
      <div className="flex justify-end">
        <Link
          href="/d/history"
          className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
        >
          View history
        </Link>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm font-medium px-4 py-3 rounded-lg shadow-xl max-w-xs text-center">
          {toast}
        </div>
      )}

      {/* Your deliveries */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
          Your deliveries ({assigned.length})
        </h2>

        {assigned.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">
            No deliveries assigned to you.
          </p>
        ) : (
          <div className="space-y-4">
            {assigned.map((d) => (
              <AssignedCard
                key={d.id}
                delivery={d}
                onAction={handleDeliver}
                inFlight={actionInFlight === d.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Available pool */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
          Available ({available.length})
        </h2>

        {available.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">
            No deliveries available to claim.
          </p>
        ) : (
          <div className="space-y-3">
            {available.map((d) => (
              <AvailableCard key={d.id} delivery={d} onClaim={handleClaim} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
