import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/index";
import { db } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";

export const runtime = "nodejs";

// How often to push fresh data (ms)
const POLL_INTERVAL_MS = 5_000;

// How often to send a heartbeat (ms)
const HEARTBEAT_INTERVAL_MS = 15_000;

// Window for "new orders" notifications
const NEW_ORDER_WINDOW_MS = 5 * 60 * 1_000; // 5 minutes

// Window for status counts
const STATUS_COUNT_WINDOW_MS = 24 * 60 * 60 * 1_000; // 24 hours

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

interface NewOrderSummary {
  id: string;
  number: number;
  customerName: string;
  status: OrderStatus;
  createdAt: string;
}

interface OrdersPayload {
  statusCounts: Partial<Record<OrderStatus, number>>;
  newOrders: NewOrderSummary[];
}

async function fetchOrdersPayload(churchId: string): Promise<OrdersPayload> {
  const windowStart24h = new Date(Date.now() - STATUS_COUNT_WINDOW_MS);
  const windowStart5m = new Date(Date.now() - NEW_ORDER_WINDOW_MS);

  const [statusRows, recentOrders] = await Promise.all([
    // Group-by status for orders in the last 24 hours
    db.order.groupBy({
      by: ["status"],
      where: {
        churchId,
        createdAt: { gte: windowStart24h },
      },
      _count: { _all: true },
    }),
    // Most recent 3 orders in the last 5 minutes
    db.order.findMany({
      where: {
        churchId,
        createdAt: { gte: windowStart5m },
      },
      select: {
        id: true,
        number: true,
        status: true,
        createdAt: true,
        customer: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  const statusCounts: Partial<Record<OrderStatus, number>> = {};
  for (const row of statusRows) {
    statusCounts[row.status] = row._count._all;
  }

  const newOrders: NewOrderSummary[] = recentOrders.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    customerName: o.customer?.name ?? "Guest",
  }));

  return { statusCounts, newOrders };
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

      // Send initial snapshot
      try {
        const payload = await fetchOrdersPayload(churchId);
        send("orders", payload);
      } catch {
        controller.close();
        return;
      }

      // Poll loop — push updated snapshot every POLL_INTERVAL_MS
      const pollInterval = setInterval(async () => {
        try {
          const payload = await fetchOrdersPayload(churchId);
          send("orders", payload);
        } catch {
          clearInterval(pollInterval);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      }, POLL_INTERVAL_MS);

      // Heartbeat loop — keep the connection alive every HEARTBEAT_INTERVAL_MS
      const heartbeatInterval = setInterval(() => {
        send("heartbeat", { ts: Date.now() });
      }, HEARTBEAT_INTERVAL_MS);

      // Clean up when client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
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
