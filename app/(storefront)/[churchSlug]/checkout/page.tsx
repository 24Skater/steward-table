"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/hooks/use-cart";

type FulfillmentType = "PICKUP" | "DELIVERY" | "DINE_IN";

const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  PICKUP: "Pickup",
  DELIVERY: "Delivery",
  DINE_IN: "Dine-in",
};

interface DeliveryZone {
  id: string;
  name: string;
  postalCodes: string[];
  feeCents: number;
  minOrderCents: number;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CheckoutPage() {
  const params = useParams<{ churchSlug: string }>();
  const router = useRouter();
  const { items, total, clearCart } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("PICKUP");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delivery zone state
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [postalCode, setPostalCode] = useState("");
  const [matchedZone, setMatchedZone] = useState<DeliveryZone | null>(null);
  const [zoneChecked, setZoneChecked] = useState(false);

  const churchSlug = params.churchSlug;

  // Fetch delivery zones once when component mounts
  useEffect(() => {
    fetch(`/api/storefront/${churchSlug}/delivery-zones`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DeliveryZone[]) => setDeliveryZones(data))
      .catch(() => {
        // Silently ignore — delivery zone lookup is best-effort
      });
  }, [churchSlug]);

  // Match postal code against zones on input change
  useEffect(() => {
    if (fulfillment !== "DELIVERY" || !postalCode.trim()) {
      setMatchedZone(null);
      setZoneChecked(false);
      return;
    }
    setZoneChecked(true);
    const trimmed = postalCode.trim();
    const found = deliveryZones.find((z) => z.postalCodes.includes(trimmed)) ?? null;
    setMatchedZone(found);
  }, [postalCode, deliveryZones, fulfillment]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-xl font-semibold text-slate-700">Your cart is empty</p>
        <button
          onClick={() => router.push(`/${churchSlug}/menu`)}
          className="mt-6 text-emerald-600 underline-offset-2 hover:underline"
        >
          Browse the menu
        </button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (fulfillment === "DELIVERY") {
      if (!postalCode.trim()) {
        setError("Please enter your postal code for delivery.");
        return;
      }
      if (!matchedZone) {
        setError("Delivery is not available to your area.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/storefront/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          churchSlug,
          customerName: name.trim(),
          phone: phone.trim() || null,
          notes: notes.trim() || null,
          fulfillment,
          zoneId: fulfillment === "DELIVERY" && matchedZone ? matchedZone.id : undefined,
          items: items.map((item) => ({
            itemId: item.itemId,
            catalogId: item.catalogId,
            itemName: item.itemName,
            quantity: item.quantity,
            basePrice: item.basePrice,
            modifiers: item.modifiers,
            totalPrice: item.totalPrice,
          })),
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      const data = (await res.json()) as { orderId: string; orderNumber: number };
      clearCart();
      router.push(`/${churchSlug}/order/${data.orderId}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const deliveryFee = fulfillment === "DELIVERY" && matchedZone ? matchedZone.feeCents : 0;
  const orderTotal = total + deliveryFee;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Checkout</h1>

      <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-600">
          {items.length} {items.length === 1 ? "item" : "items"} &mdash;{" "}
          <span className="font-semibold text-slate-800">{formatCents(total)}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
            Name <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            autoComplete="name"
          />
        </div>

        <div>
          <Label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-slate-700">
            Phone <span className="text-slate-400 font-normal">(optional)</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            autoComplete="tel"
          />
        </div>

        <div>
          <Label className="mb-2 block text-sm font-medium text-slate-700">
            How would you like to receive your order?
          </Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FULFILLMENT_LABELS) as FulfillmentType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFulfillment(type)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  fulfillment === type
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {FULFILLMENT_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {fulfillment === "DELIVERY" && (
          <div className="space-y-2">
            <Label htmlFor="postal-code" className="block text-sm font-medium text-slate-700">
              Postal code <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="postal-code"
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="e.g. 20715"
              autoComplete="postal-code"
              className="max-w-xs"
            />
            {zoneChecked && postalCode.trim() && (
              matchedZone ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <span className="font-medium">{matchedZone.name}</span>
                  {" — "}
                  Delivery fee: {formatCents(matchedZone.feeCents)}
                  {matchedZone.minOrderCents > 0 && (
                    <span className="text-emerald-700">
                      {" "}(min. order {formatCents(matchedZone.minOrderCents)})
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-rose-600">
                  Delivery is not available to your area.
                </p>
              )
            )}
          </div>
        )}

        <div>
          <Label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-slate-700">
            Notes <span className="text-slate-400 font-normal">(optional)</span>
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Allergies, special requests..."
            rows={3}
          />
        </div>

        {deliveryFee > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatCents(total)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery fee</span>
              <span>{formatCents(deliveryFee)}</span>
            </div>
            <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-100 pt-1 mt-1">
              <span>Total</span>
              <span>{formatCents(orderTotal)}</span>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
          size="lg"
        >
          {submitting ? "Placing order..." : `Place order — ${formatCents(orderTotal)}`}
        </Button>
      </form>
    </div>
  );
}
