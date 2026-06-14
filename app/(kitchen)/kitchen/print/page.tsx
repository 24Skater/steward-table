import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { PrintButton } from "./print-button";

const KITCHEN_STATUSES: OrderStatus[] = ["CONFIRMED", "IN_KITCHEN", "READY"];

function fulfillmentLabel(type: string): string {
  switch (type) {
    case "PICKUP":
      return "Pickup";
    case "DELIVERY":
      return "Delivery";
    case "DINE_IN":
      return "Dine-in";
    default:
      return type;
  }
}

function statusLabel(status: OrderStatus): string {
  switch (status) {
    case "CONFIRMED":
      return "Confirmed";
    case "IN_KITCHEN":
      return "In Kitchen";
    case "READY":
      return "Ready";
    default:
      return status;
  }
}

function formatTime(dateStr: string | Date): string {
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function fetchActiveOrders(churchId: string) {
  return db.order.findMany({
    where: {
      churchId,
      status: { in: KITCHEN_STATUSES },
    },
    select: {
      id: true,
      number: true,
      status: true,
      fulfillment: true,
      scheduledFor: true,
      createdAt: true,
      notes: true,
      customer: {
        select: { name: true },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          itemName: true,
          modifierSnapshot: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

type RawOrder = Awaited<ReturnType<typeof fetchActiveOrders>>[number];
type ModifierSnapshot = Array<{
  groupName: string;
  options: Array<{ name: string; priceDelta: number }>;
}>;

export default async function KitchenPrintPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!membership) {
    redirect("/auth/sign-in");
  }

  const orders: RawOrder[] = await fetchActiveOrders(membership.churchId);

  const printedAt = new Date().toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; }
        }

        @media screen {
          body { background: #f1f5f9; }
        }

        .order-card {
          page-break-inside: avoid;
          break-inside: avoid;
        }
      `}</style>

      <div className="min-h-screen p-6 font-sans">
        {/* Print header */}
        <header className="flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-300">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Active Orders</h1>
            <p className="text-sm text-gray-500 mt-0.5">Printed {printedAt}</p>
          </div>
          <div className="flex items-center gap-3 no-print">
            <span className="text-sm text-gray-600">
              {orders.length} {orders.length === 1 ? "order" : "orders"}
            </span>
            <PrintButton />
          </div>
        </header>

        {orders.length === 0 ? (
          <p className="text-center text-gray-500 text-lg py-16">No active orders to print.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            {orders.map((order) => {
              const modifiers = (item: RawOrder["items"][number]): ModifierSnapshot =>
                (item.modifierSnapshot as ModifierSnapshot | null) ?? [];

              const displayTime = order.scheduledFor
                ? formatTime(order.scheduledFor)
                : formatTime(order.createdAt);

              return (
                <div
                  key={order.id}
                  className="order-card bg-white border-2 border-gray-300 rounded-lg overflow-hidden"
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b border-gray-300">
                    <span className="font-bold text-lg text-gray-900">#{order.number}</span>
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {statusLabel(order.status)}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="px-3 py-2 space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id}>
                        <p className="font-semibold text-gray-900">
                          {item.quantity} &times; {item.itemName}
                        </p>
                        {modifiers(item).map((group) => (
                          <div key={group.groupName} className="pl-3 mt-0.5">
                            {group.options.map((opt) => (
                              <p key={opt.name} className="text-sm text-gray-500">
                                {group.groupName}: {opt.name}
                              </p>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Notes */}
                  {order.notes && (
                    <div className="px-3 py-1.5 bg-yellow-50 border-t border-yellow-200">
                      <p className="text-sm text-yellow-800 font-medium">Note: {order.notes}</p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-3 py-2 border-t border-gray-200">
                    <p className="text-sm text-gray-600">{order.customer?.name ?? "Guest"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fulfillmentLabel(order.fulfillment)} &middot; {displayTime}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
