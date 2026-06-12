"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/hooks/use-cart";

type FulfillmentType = "PICKUP" | "DELIVERY" | "DINE_IN";
type PaymentMethod = "pay_online" | "pay_on_pickup" | "cash" | "zelle";

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

interface TimeSlot {
  value: string;
  label: string;
  available: boolean;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function getNextSevenDays(): Array<{ value: string; label: string }> {
  const days = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const label = i === 0
      ? `Today ${monthNames[d.getMonth()]} ${d.getDate()}`
      : `${dayNames[d.getDay()]} ${monthNames[d.getMonth()]} ${d.getDate()}`;
    days.push({ value, label });
  }
  return days;
}

export default function CheckoutPage() {
  const params = useParams<{ churchSlug: string }>();
  const router = useRouter();
  const { items, total, clearCart } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("PICKUP");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pay_on_pickup");
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [acceptCash, setAcceptCash] = useState(true);
  const [acceptZelle, setAcceptZelle] = useState(false);
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [dineInEnabled, setDineInEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smsOptIn, setSmsOptIn] = useState(false);

  // Delivery zone state
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [postalCode, setPostalCode] = useState("");
  const [matchedZone, setMatchedZone] = useState<DeliveryZone | null>(null);
  const [zoneChecked, setZoneChecked] = useState(false);

  // Time slot state
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Tip state
  const [tipEnabled, setTipEnabled] = useState(false);
  const [tipPercentages, setTipPercentages] = useState<number[]>([10, 15, 20]);
  const [selectedTipPct, setSelectedTipPct] = useState<number | null>(null);

  const churchSlug = params.churchSlug;
  const nextSevenDays = getNextSevenDays();

  // Fetch delivery zones and payment config once when component mounts
  useEffect(() => {
    fetch(`/api/storefront/${churchSlug}/delivery-zones`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DeliveryZone[]) => setDeliveryZones(data))
      .catch(() => {
        // Silently ignore — delivery zone lookup is best-effort
      });

    fetch(`/api/storefront/${churchSlug}/payment-config`)
      .then((res) => (res.ok ? res.json() : { stripeEnabled: false, acceptCash: true, acceptZelle: false }))
      .then((data: { stripeEnabled: boolean; acceptCash?: boolean; acceptZelle?: boolean; pickupEnabled?: boolean; deliveryEnabled?: boolean; dineInEnabled?: boolean }) => {
        setStripeEnabled(data.stripeEnabled);
        setAcceptCash(data.acceptCash ?? true);
        setAcceptZelle(data.acceptZelle ?? false);
        const pickup = data.pickupEnabled ?? true;
        const delivery = data.deliveryEnabled ?? false;
        const dineIn = data.dineInEnabled ?? false;
        setPickupEnabled(pickup);
        setDeliveryEnabled(delivery);
        setDineInEnabled(dineIn);
        // Auto-select first available fulfillment type
        if (!pickup) {
          if (delivery) setFulfillment("DELIVERY");
          else if (dineIn) setFulfillment("DINE_IN");
        }
      })
      .catch(() => {
        // Silently ignore — payment config is best-effort
      });

    fetch(`/api/storefront/${churchSlug}/tip-config`)
      .then((res) => (res.ok ? res.json() : { tipEnabled: false, tipPercentages: [] }))
      .then((data: { tipEnabled: boolean; tipPercentages: number[] }) => {
        setTipEnabled(data.tipEnabled);
        if (data.tipPercentages.length > 0) setTipPercentages(data.tipPercentages);
      })
      .catch(() => {
        // Silently ignore — tip config is best-effort
      });
  }, [churchSlug]);

  const fetchTimeSlots = useCallback(
    (date: string) => {
      setSlotsLoading(true);
      setSelectedSlot(null);
      fetch(`/api/storefront/${churchSlug}/time-slots?date=${date}`)
        .then((res) => (res.ok ? res.json() : { slots: [] }))
        .then((data: { slots: TimeSlot[] }) => {
          setTimeSlots(data.slots);
        })
        .catch(() => {
          setTimeSlots([]);
        })
        .finally(() => {
          setSlotsLoading(false);
        });
    },
    [churchSlug],
  );

  // Fetch time slots when fulfillment is PICKUP and date changes
  useEffect(() => {
    if (fulfillment === "PICKUP") {
      fetchTimeSlots(selectedDate);
    }
  }, [fulfillment, selectedDate, fetchTimeSlots]);

  // Reset slot selection when switching away from PICKUP
  useEffect(() => {
    if (fulfillment !== "PICKUP") {
      setSelectedSlot(null);
      setTimeSlots([]);
    }
  }, [fulfillment]);

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

    // selectedSlot can be null if customer chose "ASAP" (no specific time)
    // The slot grid still works — null means ASAP, string means a specific slot

    setSubmitting(true);

    if (paymentMethod === "pay_online") {
      try {
        const res = await fetch(`/api/storefront/stripe/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cartPayload),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "Failed to start checkout. Please try again.");
          return;
        }

        const data = (await res.json()) as { url: string | null };
        if (data.url) {
          // Redirect to Stripe Checkout — cart cleared on success page redirect
          window.location.href = data.url;
        } else {
          setError("Could not open payment page. Please try again.");
        }
      } catch {
        setError("Network error. Please check your connection and try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Cash / Zelle / pay-on-pickup — all go through the same order creation route
    try {
      const res = await fetch(`/api/storefront/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cartPayload),
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
  const tipCents = selectedTipPct !== null ? Math.round(total * selectedTipPct / 100) : 0;
  const orderTotal = total + deliveryFee + tipCents;

  const cartPayload = {
    churchSlug,
    customerName: name.trim(),
    phone: phone.trim() || null,
    email: email.trim() || null,
    notes: notes.trim() || null,
    fulfillment,
    paymentMethod,
    zoneId: fulfillment === "DELIVERY" && matchedZone ? matchedZone.id : undefined,
    scheduledFor: fulfillment === "PICKUP" && selectedSlot ? selectedSlot : null,
    smsOptIn: phone.trim() ? smsOptIn : false,
    tip: tipCents,
    items: items.map((item) => ({
      itemId: item.itemId,
      catalogId: item.catalogId,
      itemName: item.itemName,
      quantity: item.quantity,
      basePrice: item.basePrice,
      modifiers: item.modifiers,
      totalPrice: item.totalPrice,
    })),
  };

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
          <Label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email <span className="text-slate-400 font-normal">(optional)</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <p className="mt-1 text-xs text-slate-400">For order confirmation emails</p>
        </div>

        <div>
          <Label className="mb-2 block text-sm font-medium text-slate-700">
            How would you like to receive your order?
          </Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FULFILLMENT_LABELS) as FulfillmentType[])
              .filter((type) =>
                type === "PICKUP" ? pickupEnabled
                : type === "DELIVERY" ? deliveryEnabled
                : dineInEnabled
              )
              .map((type) => (
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

        {fulfillment === "PICKUP" && (
          <div className="space-y-3">
            <Label className="block text-sm font-medium text-slate-700">
              Pickup time
            </Label>

            {/* ASAP option */}
            <button
              type="button"
              onClick={() => setSelectedSlot(null)}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium text-left transition-colors ${
                selectedSlot === null
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              As soon as possible (ASAP)
            </button>

            {/* Date selector — horizontal scroll */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {nextSevenDays.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => setSelectedDate(day.value)}
                  className={`flex-none rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedDate === day.value
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>

            {/* Time slot grid */}
            {slotsLoading ? (
              <p className="text-sm text-slate-500">Loading available times…</p>
            ) : timeSlots.length === 0 ? (
              <p className="text-sm text-slate-500">No specific slots available for this date.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {timeSlots.map((slot) => (
                  <button
                    key={slot.value}
                    type="button"
                    onClick={() => setSelectedSlot(slot.value)}
                    disabled={!slot.available}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      selectedSlot === slot.value
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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

        {(stripeEnabled || acceptCash || acceptZelle) && (
          <div>
            <Label className="mb-2 block text-sm font-medium text-slate-700">
              How would you like to pay?
            </Label>
            <div className="flex flex-wrap gap-2">
              {stripeEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod("pay_online")}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    paymentMethod === "pay_online"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Card (pay now)
                </button>
              )}
              {acceptCash && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    paymentMethod === "cash"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Cash on pickup
                </button>
              )}
              {acceptZelle && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod("zelle")}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    paymentMethod === "zelle"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Zelle
                </button>
              )}
              {!stripeEnabled && !acceptCash && !acceptZelle && (
                <button
                  type="button"
                  onClick={() => setPaymentMethod("pay_on_pickup")}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    paymentMethod === "pay_on_pickup"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Pay on pickup
                </button>
              )}
            </div>
            {paymentMethod === "zelle" && (
              <p className="mt-2 text-xs text-slate-500">
                We&apos;ll email you Zelle payment instructions after placing your order.
              </p>
            )}
          </div>
        )}

        {phone.trim() && (
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <input
              id="sms-opt-in"
              type="checkbox"
              checked={smsOptIn}
              onChange={(e) => setSmsOptIn(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-emerald-600 cursor-pointer"
            />
            <label htmlFor="sms-opt-in" className="text-xs text-slate-600 cursor-pointer leading-relaxed">
              By checking this box and providing your phone number, you agree to receive transactional SMS messages about your order. Message frequency varies. Message and data rates may apply. Reply HELP for help, STOP to unsubscribe. Consent is not a condition of purchase.
            </label>
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

        {tipEnabled && (
          <div>
            <Label className="mb-2 block text-sm font-medium text-slate-700">
              Add a tip? <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {tipPercentages.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setSelectedTipPct(selectedTipPct === pct ? null : pct)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    selectedTipPct === pct
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {pct}% ({formatCents(Math.round(total * pct / 100))})
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedTipPct(null)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  selectedTipPct === null
                    ? "border-slate-800 bg-slate-800 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                No tip
              </button>
            </div>
          </div>
        )}

        {(deliveryFee > 0 || tipCents > 0) && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatCents(total)}</span>
            </div>
            {deliveryFee > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Delivery fee</span>
                <span>{formatCents(deliveryFee)}</span>
              </div>
            )}
            {tipCents > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tip ({selectedTipPct}%)</span>
                <span>{formatCents(tipCents)}</span>
              </div>
            )}
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
          {submitting
            ? paymentMethod === "pay_online"
              ? "Redirecting to payment..."
              : "Placing order..."
            : paymentMethod === "pay_online"
              ? `Pay ${formatCents(orderTotal)} online`
              : `Place order — ${formatCents(orderTotal)}`}
        </Button>
      </form>
    </div>
  );
}
