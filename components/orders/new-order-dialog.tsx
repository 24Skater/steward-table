"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CatalogSummary {
  id: string;
  name: string;
}

interface CatalogItem {
  id: string;
  itemId: string;
  itemName: string;
  unitPrice: number; // cents
}

interface CartItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  modifierSnapshot: { optionName: string; priceDelta: number }[];
}

type Channel = "PHONE" | "IN_PERSON";
type Fulfillment = "PICKUP" | "DELIVERY" | "DINE_IN";
type PaymentMethod = "CASH" | "ZELLE" | "PAY_ON_PICKUP";

interface NewOrderDialogProps {
  open: boolean;
  onClose: () => void;
  churchId: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FULFILLMENT_LABELS: Record<Fulfillment, string> = {
  PICKUP: "Pickup",
  DELIVERY: "Delivery",
  DINE_IN: "Dine-in",
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  ZELLE: "Zelle",
  PAY_ON_PICKUP: "Pay on pickup",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

// ── Step 1: Items ─────────────────────────────────────────────────────────────

interface StepItemsProps {
  churchId: string;
  selectedCatalogId: string;
  onSelectCatalog: (id: string) => void;
  cart: CartItem[];
  onAddItem: (item: CatalogItem) => void;
  onChangeQty: (itemId: string, qty: number) => void;
  onRemoveItem: (itemId: string) => void;
  onNext: () => void;
  channel: Channel;
  onChannelChange: (c: Channel) => void;
}

function StepItems({
  churchId,
  selectedCatalogId,
  onSelectCatalog,
  cart,
  onAddItem,
  onChangeQty,
  onRemoveItem,
  onNext,
  channel,
  onChannelChange,
}: StepItemsProps) {
  const [catalogs, setCatalogs] = useState<CatalogSummary[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // Fetch catalog list on mount
  useEffect(() => {
    setLoadingCatalogs(true);
    fetch(`/api/catalogs?churchId=${churchId}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setCatalogs(
            (data as { id: string; name: string }[]).map((c) => ({
              id: c.id,
              name: c.name,
            })),
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCatalogs(false));
  }, [churchId]);

  // Fetch items when catalog changes
  useEffect(() => {
    if (!selectedCatalogId) {
      setCatalogItems([]);
      return;
    }
    setLoadingItems(true);
    fetch(`/api/catalogs/${selectedCatalogId}/items`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setCatalogItems(
            (
              data as {
                itemId: string;
                item: { id: string; name: string; defaultPrice: number };
                priceOverride: number | null;
                isAvailable: boolean;
              }[]
            )
              .filter((ci) => ci.isAvailable && ci.item)
              .map((ci) => ({
                id: ci.itemId,
                itemId: ci.itemId,
                itemName: ci.item.name,
                unitPrice: ci.priceOverride ?? ci.item.defaultPrice,
              })),
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoadingItems(false));
  }, [selectedCatalogId, churchId]);

  const total = cartTotal(cart);
  const canProceed = selectedCatalogId && cart.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Channel */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1.5">Order channel</p>
        <div className="flex gap-2">
          {(["IN_PERSON", "PHONE"] as Channel[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChannelChange(c)}
              className={[
                "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                channel === c
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {c === "IN_PERSON" ? "In person" : "Phone"}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog selector */}
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1.5 block" htmlFor="catalog-select">
          Catalog
        </label>
        {loadingCatalogs ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <select
            id="catalog-select"
            value={selectedCatalogId}
            onChange={(e) => onSelectCatalog(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="">Select a catalog…</option>
            {catalogs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Item list */}
      {selectedCatalogId && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5">Items</p>
          {loadingItems ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : catalogItems.length === 0 ? (
            <p className="text-sm text-slate-400">No items in this catalog.</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto rounded-md border border-slate-200">
              {catalogItems.map((ci) => {
                const inCart = cart.find((c) => c.itemId === ci.itemId);
                return (
                  <div
                    key={ci.itemId}
                    className="flex items-center justify-between px-3 py-2 hover:bg-slate-50"
                  >
                    <div>
                      <span className="text-sm text-slate-700">{ci.itemName}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {formatCents(ci.unitPrice)}
                      </span>
                    </div>
                    {inCart ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            inCart.quantity > 1
                              ? onChangeQty(ci.itemId, inCart.quantity - 1)
                              : onRemoveItem(ci.itemId)
                          }
                          className="w-6 h-6 rounded border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-100 flex items-center justify-center"
                        >
                          −
                        </button>
                        <span className="text-sm tabular-nums w-4 text-center">
                          {inCart.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onChangeQty(ci.itemId, inCart.quantity + 1)}
                          className="w-6 h-6 rounded border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-100 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAddItem(ci)}
                        className="text-xs rounded-md border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cart summary */}
      {cart.length > 0 && (
        <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between">
          <span className="text-sm text-slate-600">
            {cart.reduce((s, c) => s + c.quantity, 0)} item
            {cart.reduce((s, c) => s + c.quantity, 0) !== 1 ? "s" : ""}
          </span>
          <span className="text-sm font-semibold text-slate-800">{formatCents(total)}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          disabled={!canProceed}
          onClick={onNext}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Customer ──────────────────────────────────────────────────────────

interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

interface StepCustomerProps {
  info: CustomerInfo;
  onChange: (info: CustomerInfo) => void;
  onBack: () => void;
  onNext: () => void;
}

function StepCustomer({ info, onChange, onBack, onNext }: StepCustomerProps) {
  const canProceed = info.name.trim().length > 0;

  function set(field: keyof CustomerInfo, value: string) {
    onChange({ ...info, [field]: value });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block" htmlFor="cust-name">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="cust-name"
          type="text"
          value={info.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Full name"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block" htmlFor="cust-phone">
          Phone
        </label>
        <input
          id="cust-phone"
          type="tel"
          value={info.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="(555) 000-0000"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block" htmlFor="cust-email">
          Email
        </label>
        <input
          id="cust-email"
          type="email"
          value={info.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="customer@example.com"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block" htmlFor="cust-notes">
          Notes
        </label>
        <textarea
          id="cust-notes"
          value={info.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Allergies, special instructions…"
          rows={2}
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
        />
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!canProceed}
          onClick={onNext}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Payment ───────────────────────────────────────────────────────────

interface PaymentInfo {
  fulfillment: Fulfillment;
  paymentMethod: PaymentMethod;
}

interface StepPaymentProps {
  info: PaymentInfo;
  onChange: (info: PaymentInfo) => void;
  cart: CartItem[];
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}

function StepPayment({
  info,
  onChange,
  cart,
  onBack,
  onSubmit,
  submitting,
  error,
}: StepPaymentProps) {
  function set<K extends keyof PaymentInfo>(field: K, value: PaymentInfo[K]) {
    onChange({ ...info, [field]: value });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Fulfillment */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1.5">Fulfillment</p>
        <div className="flex gap-2">
          {(["PICKUP", "DINE_IN", "DELIVERY"] as Fulfillment[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => set("fulfillment", f)}
              className={[
                "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                info.fulfillment === f
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {FULFILLMENT_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Payment method */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1.5">Payment</p>
        <div className="flex gap-2">
          {(["CASH", "ZELLE", "PAY_ON_PICKUP"] as PaymentMethod[]).map((pm) => (
            <button
              key={pm}
              type="button"
              onClick={() => set("paymentMethod", pm)}
              className={[
                "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                info.paymentMethod === pm
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {PAYMENT_LABELS[pm]}
            </button>
          ))}
        </div>
      </div>

      {/* Order summary */}
      <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
        <p className="text-xs font-medium text-slate-500 mb-1.5">Order summary</p>
        <div className="flex flex-col gap-1">
          {cart.map((item) => (
            <div key={item.itemId} className="flex justify-between text-sm">
              <span className="text-slate-700">
                {item.quantity}× {item.itemName}
              </span>
              <span className="text-slate-600 tabular-nums">
                {formatCents(item.unitPrice * item.quantity)}
              </span>
            </div>
          ))}
          <div className="border-t border-slate-200 mt-1.5 pt-1.5 flex justify-between text-sm font-semibold">
            <span className="text-slate-700">Total</span>
            <span className="text-slate-800 tabular-nums">{formatCents(cartTotal(cart))}</span>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Creating…" : "Create order"}
        </button>
      </div>
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

const STEP_TITLES: Record<Step, string> = {
  1: "New order — Items",
  2: "New order — Customer",
  3: "New order — Payment",
};

export function NewOrderDialog({ open, onClose, churchId }: NewOrderDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [channel, setChannel] = useState<Channel>("IN_PERSON");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Step 2 state
  const [customer, setCustomer] = useState<CustomerInfo>({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });

  // Step 3 state
  const [payment, setPayment] = useState<PaymentInfo>({
    fulfillment: "PICKUP",
    paymentMethod: "CASH",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function reset() {
    setStep(1);
    setChannel("IN_PERSON");
    setSelectedCatalogId("");
    setCart([]);
    setCustomer({ name: "", phone: "", email: "", notes: "" });
    setPayment({ fulfillment: "PICKUP", paymentMethod: "CASH" });
    setSubmitting(false);
    setSubmitError(null);
    setSuccessMessage(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function addItem(ci: CatalogItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === ci.itemId);
      if (existing) {
        return prev.map((c) =>
          c.itemId === ci.itemId ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [
        ...prev,
        {
          itemId: ci.itemId,
          itemName: ci.itemName,
          quantity: 1,
          unitPrice: ci.unitPrice,
          modifierSnapshot: [],
        },
      ];
    });
  }

  function changeQty(itemId: string, qty: number) {
    setCart((prev) =>
      prev.map((c) => (c.itemId === itemId ? { ...c, quantity: qty } : c)),
    );
  }

  function removeItem(itemId: string) {
    setCart((prev) => prev.filter((c) => c.itemId !== itemId));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogId: selectedCatalogId,
          channel,
          fulfillment: payment.fulfillment,
          customerName: customer.name.trim(),
          customerPhone: customer.phone.trim() || undefined,
          customerEmail: customer.email.trim() || undefined,
          items: cart.map((item) => ({
            itemId: item.itemId,
            itemName: item.itemName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            modifierSnapshot: item.modifierSnapshot,
          })),
          notes: customer.notes.trim() || undefined,
          paymentMethod: payment.paymentMethod,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSubmitError(data.error ?? "Failed to create order");
        setSubmitting(false);
        return;
      }

      const data = (await res.json()) as { orderId: string; orderNumber: number };
      setSuccessMessage(`Order #${data.orderNumber} created`);
      setTimeout(() => {
        handleClose();
        router.refresh();
      }, 1200);
    } catch {
      setSubmitError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{successMessage ?? STEP_TITLES[step]}</DialogTitle>
        </DialogHeader>

        {successMessage ? (
          <div className="flex items-center justify-center py-6">
            <p className="text-sm text-slate-600">{successMessage}</p>
          </div>
        ) : (
          <>
            {step === 1 && (
              <StepItems
                churchId={churchId}
                selectedCatalogId={selectedCatalogId}
                onSelectCatalog={setSelectedCatalogId}
                cart={cart}
                onAddItem={addItem}
                onChangeQty={changeQty}
                onRemoveItem={removeItem}
                onNext={() => setStep(2)}
                channel={channel}
                onChannelChange={setChannel}
              />
            )}
            {step === 2 && (
              <StepCustomer
                info={customer}
                onChange={setCustomer}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            )}
            {step === 3 && (
              <StepPayment
                info={payment}
                onChange={setPayment}
                cart={cart}
                onBack={() => setStep(2)}
                onSubmit={handleSubmit}
                submitting={submitting}
                error={submitError}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
