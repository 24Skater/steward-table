"use client";

import { useState } from "react";
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

  const churchSlug = params.churchSlug;

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

    // Derive churchId from the first item's catalogId context — we pass it via the API lookup by slug
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

        {error && (
          <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
          size="lg"
        >
          {submitting ? "Placing order..." : `Place order — ${formatCents(total)}`}
        </Button>
      </form>
    </div>
  );
}
