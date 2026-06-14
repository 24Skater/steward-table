import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/index";
import { db } from "@/lib/db";
import { effectQueue } from "@/lib/orders/effect-queue";
import { transition } from "@/lib/orders/transitions";
import { buildKitchenOrderWhere, getKitchenCatalogIds } from "@/lib/kitchens/scope";
import { OrderStatus } from "@prisma/client";

export const runtime = "nodejs";

const POLL_INTERVAL_MS = 5_000;
const KITCHEN_STATUSES: OrderStatus[] = ["CONFIRMED", "IN_KITCHEN"];
const CANCELED_STATUSES: OrderStatus[] = ["CANCELED", "REFUNDED"];
const CANCELED_WINDOW_MS = 35_000;

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

interface KitchenSettings {
  kitchenDisplayMode: string;
  prepLeadTimeMinutes: number;
}

async function getKitchenSettings(churchId: string): Promise<KitchenSettings> {
  const settings = (await (db.churchSettings.findUnique as PrismaBypass)({
    where: { churchId },
    select: { kitchenDisplayMode: true, prepLeadTimeMinutes: true },
    _bypassTenancyCheck: true,
  })) as KitchenSettings | null;
  return {
    kitchenDisplayMode: settings?.kitchenDisplayMode ?? "IMMEDIATE",
    prepLeadTimeMinutes: settings?.prepLeadTimeMinutes ?? 30,
  };
}

const ORDER_SELECT = {
  id: true,
  number: true,
  status: true,
  fulfillment: true,
  scheduledFor: true,
  createdAt: true,
  notes: true,
  customer: { select: { name: true } },
  items: { select: { id: true, quantity: true, itemName: true, modifierSnapshot: true } },
} as const;

async function fetchKitchenOrders(
  churchId: string,
  catalogIds: string[],
  settings: KitchenSettings,
) {
  const all = await db.order.findMany({
    where: buildKitchenOrderWhere(churchId, catalogIds, KITCHEN_STATUSES),
    select: ORDER_SELECT,
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
  });

  if (settings.kitchenDisplayMode === "JUST_IN_TIME") {
    const cutoff = Date.now() + settings.prepLeadTimeMinutes * 60 * 1000;
    return all.filter((o) => !o.scheduledFor || o.scheduledFor.getTime() <= cutoff);
  }
  return all;
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!membership) {
    return new Response("No active membership", { status: 403 });
  }
  const churchId = membership.churchId;

  const { slug } = await params;
  const kitchen = await db.kitchen.findFirst({
    where: { churchId, slug },
    select: { id: true, isDefault: true },
  });
  if (!kitchen) {
    return new Response("Kitchen not found", { status: 404 });
  }

  const catalogIds = await getKitchenCatalogIds(db, churchId, kitchen);

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

      const settings = await getKitchenSettings(churchId);

      async function fetchRecentlyCanceled() {
        const since = new Date(Date.now() - CANCELED_WINDOW_MS);
        const rows = (await (db.order.findMany as PrismaBypass)({
          where: {
            ...buildKitchenOrderWhere(churchId, catalogIds, CANCELED_STATUSES),
            updatedAt: { gte: since },
          },
          select: ORDER_SELECT,
          _bypassTenancyCheck: true,
        })) as RawOrder[];
        return rows.map(shapeOrder);
      }

      async function fetchAndSend() {
        const orders = await fetchKitchenOrders(churchId, catalogIds, settings);
        const confirmedOrders = orders.filter((o) => o.status === "CONFIRMED");
        if (confirmedOrders.length > 0) {
          await Promise.allSettled(
            confirmedOrders.map((o) => transition(o.id, "IN_KITCHEN", { queue: effectQueue })),
          );
          const updated = await fetchKitchenOrders(churchId, catalogIds, settings);
          send("orders", updated.map(shapeOrder));
        } else {
          send("orders", orders.map(shapeOrder));
        }

        const canceled = await fetchRecentlyCanceled();
        if (canceled.length > 0) {
          send("canceled_orders", canceled);
        }
      }

      try {
        await fetchAndSend();
      } catch {
        controller.close();
        return;
      }

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
