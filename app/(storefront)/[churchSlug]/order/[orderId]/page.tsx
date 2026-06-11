import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CheckCircle2 } from "lucide-react";

interface OrderStatusPageProps {
  params: Promise<{ churchSlug: string; orderId: string }>;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Order received",
  CONFIRMED: "Confirmed",
  IN_KITCHEN: "In the kitchen",
  READY: "Ready",
  AWAITING_PICKUP: "Ready for pickup",
  PICKED_UP: "Picked up",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  SERVED: "Served",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
  REFUNDED: "Refunded",
};

export default async function OrderStatusPage({ params }: OrderStatusPageProps) {
  const { churchSlug, orderId } = await params;

  const church = await db.church.findFirst({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: { id: true, name: true },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore bypass tenancy for public storefront
    _bypassTenancyCheck: true,
  });

  if (!church) {
    notFound();
  }

  const order = await db.order.findFirst({
    where: { id: orderId, churchId: church.id },
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      fulfillment: true,
      notes: true,
      createdAt: true,
      items: {
        select: {
          itemName: true,
          quantity: true,
          unitPrice: true,
          total: true,
          modifierSnapshot: true,
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const statusLabel = STATUS_LABELS[order.status] ?? order.status;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex flex-col items-center text-center">
        <CheckCircle2 className="mb-3 h-12 w-12 text-emerald-500" />
        <h1 className="text-2xl font-bold text-slate-800">Order #{order.number}</h1>
        <p className="mt-1 text-slate-500">{statusLabel}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Items
        </h2>
        <ul className="divide-y divide-slate-100">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(order.items as any[]).map((item: { itemName: string; quantity: number; unitPrice: number; total: number; modifierSnapshot: unknown }, i: number) => {
            const mods = Array.isArray(item.modifierSnapshot)
              ? (item.modifierSnapshot as Array<{ optionName: string }>)
              : [];
            return (
              <li key={i} className="flex items-start justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {item.quantity}x {item.itemName}
                  </p>
                  {mods.length > 0 && (
                    <p className="text-xs text-slate-400">
                      {mods.map((m) => m.optionName).join(", ")}
                    </p>
                  )}
                </div>
                <span className="text-sm font-medium text-slate-700">
                  {formatCents(item.total)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex justify-between">
            <span className="text-sm font-semibold text-slate-700">Total</span>
            <span className="font-semibold text-slate-800">{formatCents(order.total)}</span>
          </div>
        </div>
      </div>

      {order.notes && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
          <p className="mt-0.5 text-sm text-slate-600">{order.notes}</p>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link
          href={`/${churchSlug}/menu`}
          className="text-sm text-emerald-600 underline-offset-2 hover:underline"
        >
          Place another order
        </Link>
      </div>
    </div>
  );
}
