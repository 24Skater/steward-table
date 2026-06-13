import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transition } from "@/lib/orders/transitions";
import { effectQueue } from "@/lib/orders/effect-queue";

function isUnauthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // dev mode — skip auth
  const authHeader = req.headers.get("authorization");
  return authHeader !== `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (isUnauthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load per-church no-show timeout settings
  const settings = await (db.churchSettings.findMany as Function)({
    where: { noShowTimeoutHours: { gt: 0 } },
    select: { churchId: true, noShowTimeoutHours: true },
    _bypassTenancyCheck: true,
  }) as Array<{ churchId: string; noShowTimeoutHours: number }>;

  if (settings.length === 0) {
    return NextResponse.json({ swept: 0, errors: 0 });
  }

  const now = Date.now();
  let swept = 0;
  let errors = 0;

  await Promise.allSettled(
    settings.map(async ({ churchId, noShowTimeoutHours }) => {
      const cutoff = new Date(now - noShowTimeoutHours * 60 * 60 * 1000);

      const staleOrders = await (db.order.findMany as Function)({
        where: {
          churchId,
          status: "AWAITING_PICKUP",
          OR: [
            { scheduledFor: { lt: cutoff } },
            { scheduledFor: null, updatedAt: { lt: cutoff } },
          ],
        },
        select: { id: true },
        _bypassTenancyCheck: true,
      }) as Array<{ id: string }>;

      await Promise.allSettled(
        staleOrders.map(async (order) => {
          try {
            await transition(order.id, "CANCELED", {
              actorId: "system",
              reason: "No-show sweep: order exceeded pickup timeout",
              queue: effectQueue,
            });
            swept++;
          } catch {
            errors++;
          }
        }),
      );
    }),
  );

  return NextResponse.json({ swept, errors });
}
