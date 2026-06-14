"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  itemName: string;
  quantity: number;
  subtotal: number;
}

interface CustomerOrder {
  id: string;
  number: number;
  status: string;
  total: number;
  createdAt: Date;
  itemCount: number;
  items: OrderItem[];
}

export interface CustomerDetailData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  smsOptIn: boolean;
  notes: string | null;
  createdAt: Date;
  stats: {
    totalOrders: number;
    totalSpentCents: number;
    avgOrderCents: number;
  };
  orders: CustomerOrder[];
}

interface CustomerDetailPageProps {
  customer: CustomerDetailData;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
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

// ── Edit form ─────────────────────────────────────────────────────────────────

interface EditFormState {
  name: string;
  email: string;
  phone: string;
  notes: string;
  smsOptIn: boolean;
}

interface EditCustomerFormProps {
  customer: CustomerDetailData;
  onCancel: () => void;
  onSaved: (updated: Partial<CustomerDetailData>) => void;
}

function EditCustomerForm({ customer, onCancel, onSaved }: EditCustomerFormProps) {
  const [form, setForm] = useState<EditFormState>({
    name: customer.name,
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    notes: customer.notes ?? "",
    smsOptIn: customer.smsOptIn,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(field: keyof EditFormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          notes: form.notes.trim() || null,
          smsOptIn: form.smsOptIn,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to save changes");
      }

      onSaved({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        smsOptIn: form.smsOptIn,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            required
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="optional"
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            placeholder="optional"
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-medium text-slate-600">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Internal notes (not visible to customer)"
            rows={3}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="smsOptIn"
          checked={form.smsOptIn}
          onChange={(e) => handleChange("smsOptIn", e.target.checked)}
          className="rounded border-slate-300"
        />
        <label htmlFor="smsOptIn" className="text-sm text-slate-700">
          SMS opt-in
        </label>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={saving} size="sm">
          {saving ? "Saving..." : "Save changes"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CustomerDetailPage({ customer: initialCustomer }: CustomerDetailPageProps) {
  const [customer, setCustomer] = useState<CustomerDetailData>(initialCustomer);
  const [editOpen, setEditOpen] = useState(false);

  function handleSaved(updated: Partial<CustomerDetailData>) {
    setCustomer((prev) => ({ ...prev, ...updated }));
    setEditOpen(false);
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-6">
        {/* Customer header card */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          {editOpen ? (
            <>
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Edit Customer</h3>
              <EditCustomerForm
                customer={customer}
                onCancel={() => setEditOpen(false)}
                onSaved={handleSaved}
              />
            </>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-800">{customer.name}</h3>
                  {customer.smsOptIn && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-green-50 text-green-700 border-green-200"
                    >
                      SMS opted in
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  {customer.email ? (
                    <p className="text-sm text-slate-600">{customer.email}</p>
                  ) : (
                    <p className="text-sm text-slate-400">No email on file</p>
                  )}
                  {customer.phone ? (
                    <p className="text-sm text-slate-600 tabular-nums">{customer.phone}</p>
                  ) : (
                    <p className="text-sm text-slate-400">No phone on file</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    Customer since {formatDate(customer.createdAt)}
                  </p>
                </div>

                {customer.notes && (
                  <p className="text-sm text-slate-500 italic mt-1">{customer.notes}</p>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
                className="shrink-0"
              >
                Edit
              </Button>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Total Orders
            </p>
            <p className="text-2xl font-semibold text-slate-800 tabular-nums">
              {customer.stats.totalOrders}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Total Spent
            </p>
            <p className="text-2xl font-semibold text-slate-800 tabular-nums">
              {formatCents(customer.stats.totalSpentCents)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Avg. Order</p>
            <p className="text-2xl font-semibold text-slate-800 tabular-nums">
              {customer.stats.totalOrders > 0 ? formatCents(customer.stats.avgOrderCents) : "—"}
            </p>
          </div>
        </div>

        {/* Orders table */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Order History</h3>
          </div>

          {customer.orders.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-slate-400">No orders yet.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-2.5 pl-4 pr-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Order #
                      </th>
                      <th className="py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Date
                      </th>
                      <th className="py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Status
                      </th>
                      <th className="py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-center">
                        Items
                      </th>
                      <th className="py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">
                        Total
                      </th>
                      <th className="py-2.5 pl-3 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">
                        View
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.orders.map((order) => {
                      const statusCfg = STATUS_CONFIG[order.status] ?? {
                        label: order.status,
                        className: "bg-slate-100 text-slate-600 border-slate-200",
                      };
                      return (
                        <tr
                          key={order.id}
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-3 pl-4 pr-3 font-mono font-semibold text-sm text-slate-800 tabular-nums">
                            #{order.number}
                          </td>
                          <td className="py-3 px-3 text-sm text-slate-600">
                            {formatDate(order.createdAt)}
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              variant="outline"
                              className={`text-xs font-medium whitespace-nowrap ${statusCfg.className}`}
                            >
                              {statusCfg.label}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-sm text-slate-600 text-center tabular-nums">
                            {order.itemCount}
                          </td>
                          <td className="py-3 px-3 text-sm font-medium text-slate-800 text-right tabular-nums">
                            {formatCents(order.total)}
                          </td>
                          <td className="py-3 pl-3 pr-4 text-right">
                            <Link
                              href={`/orders/${order.id}`}
                              className="text-xs font-medium text-slate-600 hover:text-slate-800 underline underline-offset-2"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile card stack */}
              <div className="sm:hidden flex flex-col divide-y divide-slate-100">
                {customer.orders.map((order) => {
                  const statusCfg = STATUS_CONFIG[order.status] ?? {
                    label: order.status,
                    className: "bg-slate-100 text-slate-600 border-slate-200",
                  };
                  return (
                    <div key={order.id} className="p-4 flex flex-col gap-2">
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
                          {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-700">
                          {formatCents(order.total)}
                        </p>
                        <Link
                          href={`/orders/${order.id}`}
                          className="text-xs font-medium text-slate-600 hover:text-slate-800 underline underline-offset-2"
                        >
                          View order
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
