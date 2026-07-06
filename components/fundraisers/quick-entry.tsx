"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSendQueue } from "@/hooks/use-send-queue";
import { isDeliveryEligible } from "@/lib/fundraisers/delivery-eligibility";
import { useMemo, useState } from "react";

export interface QuickEntryOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface QuickEntryModifierGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: QuickEntryOption[];
}

export interface QuickEntryItem {
  itemId: string;
  name: string;
  price: number; // cents, resolved (priceOverride ?? defaultPrice)
  modifierGroups: QuickEntryModifierGroup[];
}

export interface QuickEntryCatalog {
  catalogId: string;
  catalogName: string;
  churchName: string;
  minItemsForDelivery: number | null;
  deliveryEnabled: boolean;
  items: QuickEntryItem[];
}

interface CartLine {
  key: string; // itemId + serialized selections
  itemId: string;
  itemName: string;
  basePrice: number;
  quantity: number;
  modifiers: { groupName: string; optionName: string; priceDelta: number }[];
}

interface QuickEntryProps {
  catalog: QuickEntryCatalog;
  endpoint: string; // POST target (staff or volunteer door)
  takerLabel: string; // "as Maria" strip text
  extraPayload?: Record<string, unknown>; // e.g. { volunteerName }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function lineUnitPrice(line: CartLine): number {
  return line.basePrice + line.modifiers.reduce((s, m) => s + m.priceDelta, 0);
}

export function QuickEntry({ catalog, endpoint, takerLabel, extraPayload }: QuickEntryProps) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickerItem, setPickerItem] = useState<QuickEntryItem | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fulfillment, setFulfillment] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [address, setAddress] = useState({ line1: "", city: "", region: "", postalCode: "" });
  const [markPaidCash, setMarkPaidCash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { enqueue, pending, lastResult, lastRejection, hasStuckSubmits } = useSendQueue(
    `quick-entry:${catalog.catalogId}`,
    endpoint,
  );

  const itemCount = useMemo(() => cart.reduce((s, l) => s + l.quantity, 0), [cart]);
  const total = useMemo(() => cart.reduce((s, l) => s + lineUnitPrice(l) * l.quantity, 0), [cart]);
  const deliveryEligible =
    catalog.deliveryEnabled && isDeliveryEligible(itemCount, catalog.minItemsForDelivery);

  // Auto-flip back to pickup if the cart drops below the delivery threshold
  if (fulfillment === "DELIVERY" && !deliveryEligible) {
    setFulfillment("PICKUP");
    setError(
      catalog.minItemsForDelivery
        ? `Delivery needs at least ${catalog.minItemsForDelivery} items — switched to pickup.`
        : "Delivery unavailable — switched to pickup.",
    );
  }

  function addLine(item: QuickEntryItem, modifiers: CartLine["modifiers"]) {
    const key = `${item.itemId}:${modifiers.map((m) => m.optionName).join("|")}`;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          key,
          itemId: item.itemId,
          itemName: item.name,
          basePrice: item.price,
          quantity: 1,
          modifiers,
        },
      ];
    });
  }

  function handleTileTap(item: QuickEntryItem) {
    setError(null);
    if (item.modifierGroups.length > 0) {
      setPickerItem(item);
    } else {
      addLine(item, []);
    }
  }

  function decrementItem(itemId: string) {
    setCart((prev) =>
      prev
        .map((l) => (l.itemId === itemId ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function itemQty(itemId: string): number {
    return cart.filter((l) => l.itemId === itemId).reduce((s, l) => s + l.quantity, 0);
  }

  function resetForNextOrder() {
    setCart([]);
    setCustomerName("");
    setPhone("");
    setEmail("");
    setFulfillment("PICKUP");
    setAddress({ line1: "", city: "", region: "", postalCode: "" });
    setMarkPaidCash(false);
    setSheetOpen(false);
    setError(null);
  }

  function handleSubmit() {
    if (!customerName.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    if (fulfillment === "DELIVERY" && (!address.line1.trim() || !address.postalCode.trim())) {
      setError("Delivery needs a street address and ZIP.");
      return;
    }
    const payload = {
      ...extraPayload,
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      fulfillment,
      deliveryAddress: fulfillment === "DELIVERY" ? { ...address, country: "US" } : null,
      markPaidCash,
      items: cart.map((l) => ({
        itemId: l.itemId,
        catalogId: catalog.catalogId,
        itemName: l.itemName,
        quantity: l.quantity,
        basePrice: l.basePrice,
        modifiers: l.modifiers,
        totalPrice: lineUnitPrice(l) * l.quantity,
      })),
    };
    enqueue(payload, customerName.trim());
    resetForNextOrder();
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-32">
      {/* Header strip */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{catalog.catalogName}</h1>
            <p className="text-sm text-slate-500">
              {catalog.churchName} · taking orders {takerLabel}
            </p>
          </div>
          {pending.length > 0 && (
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                hasStuckSubmits ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              {pending.length} sending…
            </span>
          )}
        </div>
        {lastResult && (
          <p className="mt-1 text-sm text-emerald-600">
            ✓ Order #{lastResult.orderNumber} — {lastResult.label}
          </p>
        )}
        {lastRejection && (
          <p className="mt-1 text-sm text-red-600">
            ✗ {lastRejection.label}&apos;s order was rejected: {lastRejection.message}
          </p>
        )}
        {hasStuckSubmits && (
          <p className="mt-1 text-sm text-red-600">
            Connection trouble — orders are saved on this device and will retry automatically.
          </p>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Tap grid */}
      <div className="grid grid-cols-2 gap-3">
        {catalog.items.map((item) => {
          const qty = itemQty(item.itemId);
          return (
            <div key={item.itemId} className="relative">
              <button
                type="button"
                onClick={() => handleTileTap(item)}
                className={`min-h-24 w-full rounded-xl border-2 p-3 text-center transition active:scale-95 ${
                  qty > 0 ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
                }`}
              >
                <span className="block text-base font-semibold">{item.name}</span>
                <span className="block text-sm text-slate-500">{formatCents(item.price)}</span>
              </button>
              {qty > 0 && (
                <>
                  <span className="absolute -right-2 -top-2 rounded-full bg-emerald-600 px-2.5 py-0.5 text-sm font-bold text-white">
                    ×{qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => decrementItem(item.itemId)}
                    aria-label={`Remove one ${item.name}`}
                    className="absolute -left-2 -top-2 h-7 w-7 rounded-full bg-slate-700 text-sm font-bold text-white"
                  >
                    −
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Option picker (simple modal) */}
      {pickerItem && (
        <OptionPicker
          item={pickerItem}
          onConfirm={(modifiers) => {
            addLine(pickerItem, modifiers);
            setPickerItem(null);
          }}
          onCancel={() => setPickerItem(null)}
        />
      )}

      {/* Bottom bar → customer sheet */}
      {itemCount > 0 && !sheetOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white p-4">
          <Button className="h-14 w-full text-lg" onClick={() => setSheetOpen(true)}>
            {itemCount} {itemCount === 1 ? "item" : "items"} · {formatCents(total)} — Customer info
            →
          </Button>
        </div>
      )}

      {/* Customer sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40">
          <div className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Customer info</h2>
              <button type="button" className="text-slate-500" onClick={() => setSheetOpen(false)}>
                ← Back to items
              </button>
            </div>
            <div className="space-y-3">
              <Input
                className="h-12 text-lg"
                placeholder="Name *"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <Input
                className="h-12 text-lg"
                type="tel"
                placeholder="Phone *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Input
                className="h-12 text-lg"
                type="email"
                placeholder="Email (optional — sends confirmation)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={fulfillment === "PICKUP" ? "default" : "outline"}
                  className="h-12 flex-1"
                  onClick={() => setFulfillment("PICKUP")}
                >
                  Pickup
                </Button>
                <Button
                  type="button"
                  variant={fulfillment === "DELIVERY" ? "default" : "outline"}
                  className="h-12 flex-1"
                  disabled={!deliveryEligible}
                  onClick={() => setFulfillment("DELIVERY")}
                >
                  {deliveryEligible
                    ? "Delivery"
                    : catalog.deliveryEnabled && catalog.minItemsForDelivery
                      ? `Delivery (${catalog.minItemsForDelivery}+ items)`
                      : "Delivery unavailable"}
                </Button>
              </div>
              {fulfillment === "DELIVERY" && (
                <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                  <Input
                    placeholder="Street address *"
                    value={address.line1}
                    onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="City"
                      value={address.city}
                      onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                    />
                    <Input
                      placeholder="State"
                      className="w-24"
                      value={address.region}
                      onChange={(e) => setAddress((a) => ({ ...a, region: e.target.value }))}
                    />
                    <Input
                      placeholder="ZIP *"
                      className="w-28"
                      value={address.postalCode}
                      onChange={(e) => setAddress((a) => ({ ...a, postalCode: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={markPaidCash}
                  onChange={(e) => setMarkPaidCash(e.target.checked)}
                />
                Paid cash now (default: pay at pickup/delivery)
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button className="h-14 w-full text-lg" onClick={handleSubmit}>
                Submit — {formatCents(total)} · Next order
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface OptionPickerProps {
  item: QuickEntryItem;
  onConfirm: (modifiers: CartLine["modifiers"]) => void;
  onCancel: () => void;
}

function OptionPicker({ item, onConfirm, onCancel }: OptionPickerProps) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  function toggle(group: QuickEntryModifierGroup, optionId: string) {
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      const next =
        group.maxSelections === 1
          ? [optionId]
          : [...current, optionId].slice(0, group.maxSelections);
      return { ...prev, [group.id]: next };
    });
  }

  const valid = item.modifierGroups.every((g) => {
    const count = (selections[g.id] ?? []).length;
    const min = g.isRequired ? Math.max(1, g.minSelections) : g.minSelections;
    return count >= min && count <= g.maxSelections;
  });

  function confirm() {
    const modifiers = item.modifierGroups.flatMap((g) =>
      (selections[g.id] ?? []).map((optionId) => {
        const option = g.options.find((o) => o.id === optionId);
        return {
          groupName: g.name,
          optionName: option?.name ?? "",
          priceDelta: option?.priceDelta ?? 0,
        };
      }),
    );
    onConfirm(modifiers);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
      <div className="max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">{item.name}</h2>
        {item.modifierGroups.map((group) => (
          <div key={group.id} className="mb-4">
            <p className="mb-2 text-sm font-medium text-slate-600">
              {group.name}
              {group.isRequired && <span className="text-red-500"> *</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => {
                const selected = (selections[group.id] ?? []).includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggle(group, option.id)}
                    className={`rounded-full border-2 px-4 py-2 text-sm ${
                      selected ? "border-emerald-500 bg-emerald-50" : "border-slate-200"
                    }`}
                  >
                    {option.name}
                    {option.priceDelta !== 0 && ` (+$${(option.priceDelta / 100).toFixed(2)})`}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="outline" className="h-12 flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="h-12 flex-1" disabled={!valid} onClick={confirm}>
            Add to order
          </Button>
        </div>
      </div>
    </div>
  );
}
