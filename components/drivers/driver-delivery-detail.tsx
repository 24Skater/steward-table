"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeliveryItem {
  itemName: string;
  quantity: number;
  modifiers: Array<{ groupName: string; optionName: string }>;
}

interface DriverDeliveryDetailProps {
  orderId: string;
  orderNumber: number;
  status: "READY" | "OUT_FOR_DELIVERY";
  customerName: string;
  customerPhone: string | null;
  recipientName: string;
  fullAddress: string;
  instructions: string | null;
  kitchenNotes: string | null;
  items: DeliveryItem[];
}

function buildMapsUrl(addr: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(addr)}`;
}

export function DriverDeliveryDetail({
  orderId,
  orderNumber,
  status,
  customerName,
  customerPhone,
  recipientName,
  fullAddress,
  instructions,
  kitchenNotes,
  items,
}: DriverDeliveryDetailProps) {
  const router = useRouter();
  const [inFlight, setInFlight] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isReady = status === "READY";
  const actionLabel = isReady ? "Picked up" : "Delivered";
  const nextStatus: "OUT_FOR_DELIVERY" | "DELIVERED" = isReady
    ? "OUT_FOR_DELIVERY"
    : "DELIVERED";

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleAction() {
    if (inFlight) return;
    setInFlight(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        showToast("Couldn't update — try again when you have signal.");
        setInFlight(false);
      } else {
        router.push("/d");
      }
    } catch {
      showToast("Couldn't update — try again when you have signal.");
      setInFlight(false);
    }
  }

  const displayName = recipientName !== customerName ? recipientName : customerName;

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm font-medium px-4 py-3 rounded-lg shadow-xl max-w-xs text-center">
          {toast}
        </div>
      )}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Order #{orderNumber}</h1>
          <span
            className={`text-sm font-semibold px-2.5 py-1 rounded-full ${
              isReady ? "bg-yellow-100 text-yellow-800" : "bg-blue-100 text-blue-800"
            }`}
          >
            {isReady ? "Ready" : "Out for Delivery"}
          </span>
        </div>

        {/* Recipient & Address */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-1">
          <p className="text-base font-semibold text-slate-800">{displayName}</p>
          <p className="text-sm text-slate-600">{fullAddress}</p>
        </div>

        {/* Special instructions */}
        {instructions && (
          <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700 mb-1">
              Delivery instructions
            </p>
            <p className="text-sm text-yellow-900">{instructions}</p>
          </div>
        )}

        {/* Kitchen notes */}
        {kitchenNotes && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-1">
              Kitchen notes
            </p>
            <p className="text-sm text-amber-900">{kitchenNotes}</p>
          </div>
        )}

        {/* Items */}
        <div className="rounded-xl bg-white border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Items
          </p>
          <ul className="space-y-3">
            {items.map((item, i) => (
              <li key={i}>
                <p className="text-sm font-medium text-slate-800">
                  {item.quantity}× {item.itemName}
                </p>
                {item.modifiers.length > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {item.modifiers.map((m) => m.optionName).join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Navigate + Call */}
        <div className="flex gap-3">
          <a
            href={buildMapsUrl(fullAddress)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            style={{ minHeight: "48px" }}
          >
            Navigate
          </a>
          {customerPhone && (
            <a
              href={`tel:${customerPhone}`}
              className="flex-1 flex items-center justify-center font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              style={{ minHeight: "48px" }}
            >
              Call {displayName.split(" ")[0]}
            </a>
          )}
        </div>

        {/* Primary action */}
        <button
          type="button"
          disabled={inFlight}
          onClick={handleAction}
          className={`w-full rounded-xl font-bold text-white transition-colors disabled:opacity-60 ${
            isReady
              ? "bg-slate-800 hover:bg-slate-700 active:bg-slate-900"
              : "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700"
          }`}
          style={{ minHeight: "64px", fontSize: "1.125rem" }}
        >
          {inFlight ? "Updating…" : actionLabel}
        </button>
      </div>
    </>
  );
}
