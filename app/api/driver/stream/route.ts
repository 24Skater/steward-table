import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { OrderStatus, FulfillmentType } from "@prisma/client";
import type { SessionMembership } from "@/lib/auth/types";

export const runtime = "nodejs";

const POLL_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 20_000;

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function fetchDriverPayload(churchId: string, userId: string) {
  const [rawAssigned, rawAvailable] = await Promise.all([
    (db.deliveryInfo.findMany as Function)({
      where: {
        driverId: userId,
        order: {
          churchId,
          status: { in: ["READY", "OUT_FOR_DELIVERY"] as OrderStatus[] },
        },
      },
      select: {
        order: { select: { id: true, number: true, status: true } },
      },
      _bypassTenancyCheck: true,
    }),
    (db.order.findMany as Function)({
      where: {
        churchId,
        fulfillment: "DELIVERY" as FulfillmentType,
        status: "READY" as OrderStatus,
        deliveryInfo: { driverId: null },
      },
      select: { id: true, number: true },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      _bypassTenancyCheck: true,
    }),
  ]) as [
    Array<{ order: { id: string; number: number; status: OrderStatus } }>,
    Array<{ id: string; number: number }>,
  ];

  return {
    assignedIds: rawAssigned.map((d) => `${d.order.id}:${d.order.status}`).sort(),
    availableIds: rawAvailable.map((o) => o.id).sort(),
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) {
    return new Response("No active membership", { status: 403 });
  }

  const { churchId } = membership;
  const userId = session.user.id;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        try {
          controller.enqueue(encoder.encode(sseMessage(event, data)));
        } catch {
          // Controller closed
        }
      }

      let lastAssignedKey = "";
      let lastAvailableKey = "";

      async function pushUpdate() {
        try {
          const payload = await fetchDriverPayload(churchId, userId);
          const assignedKey = payload.assignedIds.join(",");
          const availableKey = payload.availableIds.join(",");

          if (assignedKey !== lastAssignedKey || availableKey !== lastAvailableKey) {
            lastAssignedKey = assignedKey;
            lastAvailableKey = availableKey;
            send("update", { ts: Date.now() });
          }
        } catch {
          // Ignore DB errors, keep trying
        }
      }

      // Initial snapshot
      await pushUpdate();

      const pollInterval = setInterval(pushUpdate, POLL_INTERVAL_MS);

      const heartbeatInterval = setInterval(() => {
        send("heartbeat", { ts: Date.now() });
      }, HEARTBEAT_INTERVAL_MS);

      req.signal.addEventListener("abort", () => {
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
