import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/index";
import { db } from "@/lib/db";
import { effectQueue } from "@/lib/orders/effect-queue";
import { transition } from "@/lib/orders/transitions";
import { OrderStatus } from "@prisma/client";

export const runtime = "nodejs";

// How often to push fresh data (ms)
const POLL_INTERVAL_MS = 5_000;

// Active order statuses shown in kitchen
const KITCHEN_STATUSES: OrderStatus[] = ["CONFIRMED", "IN_KITCHEN", "READY"];

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function fetchKitchenOrders(churchId: string) {
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

type RawOrder = Awaited<ReturnType<typeof fetchKitchenOrders>>[number];

function shapeOrder(order: RawOrder) {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    fulfillment: order.fulfillment,
    scheduledFor: order.scheduledFor?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    customerName: order.customer?.name ?? "Guest",
    notes: order.notes ?? null,
    items: order.items.map((item) => {
      // modifierSnapshot is a JSON field:
      // Array<{ groupName: string; options: Array<{ name: string; priceDelta: number }> }>
      const modifiers = item.modifierSnapshot as Array<{
        groupName: string;
        options: Array<{ name: string; priceDelta: number }>;
      }> | null;

      return {
        id: item.id,
        itemName: item.itemName,
        quantity: item.quantity,
        modifierSnapshot: modifiers ?? [],
      };
    }),
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");

  if (!membership) {
    return new Response("No active membership", { status: 403 });
  }

  const churchId = membership.churchId;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        try {
          controller.enqueue(encoder.encode(sseMessage(event, data)));
        } catch {
          // Controller closed — stop sending
        }
      }

      async function fetchAndSend() {
        const orders = await fetchKitchenOrders(churchId);

        // Auto-transition CONFIRMED orders to IN_KITCHEN on first kitchen view
        const confirmedOrders = orders.filter((o) => o.status === "CONFIRMED");
        if (confirmedOrders.length > 0) {
          await Promise.allSettled(
            confirmedOrders.map((o) =>
              transition(o.id, "IN_KITCHEN", { queue: effectQueue }),
            ),
          );
          // Re-fetch so the sent snapshot reflects the new IN_KITCHEN status
          const updated = await fetchKitchenOrders(churchId);
          send("orders", updated.map(shapeOrder));
        } else {
          send("orders", orders.map(shapeOrder));
        }
      }

      // Send initial snapshot
      try {
        await fetchAndSend();
      } catch {
        controller.close();
        return;
      }

      // Poll loop — push updated snapshot every POLL_INTERVAL_MS
      const interval = setInterval(async () => {
        try {
          await fetchAndSend();
        } catch {
          clearInterval(interval);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      }, POLL_INTERVAL_MS);

      // Clean up when client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
