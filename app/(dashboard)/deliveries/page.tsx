import { TopBar } from "@/components/layout/top-bar";
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import type { FulfillmentType, OrderStatus } from "@prisma/client";
import { redirect } from "next/navigation";

interface DeliveryOrderRow {
  id: string;
  number: number;
  status: OrderStatus;
  fulfillment: FulfillmentType;
  scheduledFor: Date | null;
  customer: {
    name: string;
    phone: string | null;
  };
  items: Array<{
    itemName: string;
    quantity: number;
  }>;
  deliveryInfo: {
    recipientName: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string;
    postalCode: string;
  } | null;
}

interface AvailableDeliveryRow {
  id: string;
  number: number;
  status: OrderStatus;
  scheduledFor: Date | null;
  itemCount: number;
  deliveryInfo: {
    city: string;
    region: string;
  } | null;
}

const DRIVER_VISIBLE_STATUSES: OrderStatus[] = ["READY", "OUT_FOR_DELIVERY"];

const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for Delivery",
};

const STATUS_COLORS: Partial<Record<OrderStatus, string>> = {
  READY: "bg-yellow-100 text-yellow-800",
  OUT_FOR_DELIVERY: "bg-blue-100 text-blue-800",
};

function formatAddress(info: NonNullable<DeliveryOrderRow["deliveryInfo"]>): string {
  const parts = [info.line1];
  if (info.line2) parts.push(info.line2);
  parts.push(`${info.city}, ${info.region} ${info.postalCode}`);
  return parts.join(", ");
}

function formatItemSummary(items: DeliveryOrderRow["items"]): string {
  return items.map((i) => `${i.quantity}x ${i.itemName}`).join(", ");
}

function formatScheduled(d: Date | null): string {
  if (!d) return "ASAP";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export default async function DeliveriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const churchId = membership.churchId;

  const [rawDeliveries, rawAvailable] = (await Promise.all([
    // Assigned to this driver, active statuses
    (db.deliveryInfo.findMany as PrismaBypass)({
      where: {
        driverId: session.user.id,
        order: {
          churchId,
          status: { in: DRIVER_VISIBLE_STATUSES },
        },
      },
      select: {
        recipientName: true,
        line1: true,
        line2: true,
        city: true,
        region: true,
        postalCode: true,
        order: {
          select: {
            id: true,
            number: true,
            status: true,
            fulfillment: true,
            scheduledFor: true,
            customer: { select: { name: true, phone: true } },
            items: { select: { itemName: true, quantity: true } },
          },
        },
      },
      orderBy: { order: { createdAt: "asc" } },
      _bypassTenancyCheck: true,
    }),

    // Unassigned delivery orders that are READY (available pool)
    (db.order.findMany as PrismaBypass)({
      where: {
        churchId,
        fulfillment: "DELIVERY",
        status: "READY",
        deliveryInfo: { driverId: null },
      },
      select: {
        id: true,
        number: true,
        status: true,
        scheduledFor: true,
        items: { select: { id: true } },
        deliveryInfo: {
          select: {
            city: true,
            region: true,
          },
        },
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      _bypassTenancyCheck: true,
    }),
  ])) as [
    Array<{
      recipientName: string;
      line1: string;
      line2: string | null;
      city: string;
      region: string;
      postalCode: string;
      order: {
        id: string;
        number: number;
        status: OrderStatus;
        fulfillment: FulfillmentType;
        scheduledFor: Date | null;
        customer: { name: string; phone: string | null };
        items: Array<{ itemName: string; quantity: number }>;
      };
    }>,
    Array<{
      id: string;
      number: number;
      status: OrderStatus;
      scheduledFor: Date | null;
      items: Array<{ id: string }>;
      deliveryInfo: {
        city: string;
        region: string;
      } | null;
    }>,
  ];

  const deliveries: DeliveryOrderRow[] = rawDeliveries.map((d) => ({
    id: d.order.id,
    number: d.order.number,
    status: d.order.status,
    fulfillment: d.order.fulfillment,
    scheduledFor: d.order.scheduledFor,
    customer: d.order.customer,
    items: d.order.items,
    deliveryInfo: {
      recipientName: d.recipientName,
      line1: d.line1,
      line2: d.line2,
      city: d.city,
      region: d.region,
      postalCode: d.postalCode,
    },
  }));

  // Sort: OUT_FOR_DELIVERY first, then READY
  deliveries.sort((a, b) => {
    if (a.status === "OUT_FOR_DELIVERY" && b.status !== "OUT_FOR_DELIVERY") return -1;
    if (b.status === "OUT_FOR_DELIVERY" && a.status !== "OUT_FOR_DELIVERY") return 1;
    return 0;
  });

  const available: AvailableDeliveryRow[] = rawAvailable.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    scheduledFor: o.scheduledFor,
    itemCount: o.items.length,
    deliveryInfo: o.deliveryInfo
      ? { city: o.deliveryInfo.city, region: o.deliveryInfo.region }
      : null,
  }));

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Deliveries" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* ── Assigned deliveries ── */}
        <section className="mb-8 max-w-xl mx-auto">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Your deliveries ({deliveries.length})
          </h2>

          {deliveries.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">
              No deliveries assigned to you.
            </p>
          ) : (
            <ul className="space-y-4">
              {deliveries.map((delivery) => {
                const statusLabel = STATUS_LABELS[delivery.status] ?? delivery.status;
                const statusColor = STATUS_COLORS[delivery.status] ?? "bg-slate-100 text-slate-700";
                const address = delivery.deliveryInfo ? formatAddress(delivery.deliveryInfo) : null;
                const itemSummary = formatItemSummary(delivery.items);

                return (
                  <li
                    key={delivery.id}
                    className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3"
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-800">#{delivery.number}</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    {/* Customer */}
                    <div>
                      <p className="text-sm font-medium text-slate-800">{delivery.customer.name}</p>
                      {delivery.customer.phone && (
                        <a
                          href={`tel:${delivery.customer.phone}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {delivery.customer.phone}
                        </a>
                      )}
                    </div>

                    {/* Items */}
                    {itemSummary && <p className="text-sm text-slate-600">{itemSummary}</p>}

                    {/* Address */}
                    {address && <p className="text-sm text-slate-500">{address}</p>}

                    {/* Navigate + Call row */}
                    <div className="flex gap-2">
                      {address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center py-2 px-3 bg-slate-100 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-200 transition-colors min-h-[44px]"
                        >
                          Navigate
                        </a>
                      )}
                      {delivery.customer.phone && (
                        <a
                          href={`tel:${delivery.customer.phone}`}
                          className="flex-1 inline-flex items-center justify-center py-2 px-3 bg-slate-100 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-200 transition-colors min-h-[44px]"
                        >
                          Call
                        </a>
                      )}
                    </div>

                    {/* Primary action — status-aware, uses /deliver endpoint */}
                    {delivery.status === "READY" ? (
                      <form method="POST" action={`/api/orders/${delivery.id}/deliver`}>
                        <input type="hidden" name="status" value="OUT_FOR_DELIVERY" />
                        <button
                          type="submit"
                          className="w-full py-2 px-4 bg-slate-800 text-white text-sm font-medium rounded-md hover:bg-slate-700 active:bg-slate-900 transition-colors min-h-[44px]"
                        >
                          Mark Picked Up
                        </button>
                      </form>
                    ) : (
                      <form method="POST" action={`/api/orders/${delivery.id}/deliver`}>
                        <input type="hidden" name="status" value="DELIVERED" />
                        <button
                          type="submit"
                          className="w-full py-2 px-4 bg-emerald-700 text-white text-sm font-medium rounded-md hover:bg-emerald-800 active:bg-emerald-900 transition-colors min-h-[44px]"
                        >
                          Mark Delivered
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Available pool ── */}
        <section className="max-w-xl mx-auto">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Available ({available.length})
          </h2>

          {available.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">
              No deliveries available to claim.
            </p>
          ) : (
            <ul className="space-y-3">
              {available.map((order) => {
                const location = order.deliveryInfo?.city ?? "Unknown area";

                return (
                  <li
                    key={order.id}
                    className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-800">
                        #{order.number} · {location}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatScheduled(order.scheduledFor)}
                      </span>
                    </div>

                    <p className="text-sm text-slate-500">
                      {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                    </p>

                    <form method="POST" action={`/api/orders/${order.id}/claim`}>
                      <button
                        type="submit"
                        className="w-full py-2 px-4 bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-medium rounded-md hover:bg-emerald-100 active:bg-emerald-200 transition-colors min-h-[44px]"
                      >
                        Claim
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
