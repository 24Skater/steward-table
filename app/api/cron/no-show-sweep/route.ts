import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transition } from "@/lib/orders/transitions";
import { effectQueue } from "@/lib/orders/effect-queue";

const NO_SHOW_TIMEOUT_HOURS = 2;

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

  const cutoff = new Date(Date.now() - NO_SHOW_TIMEOUT_HOURS * 60 * 60 * 1000);

  const staleOrders = await db.order.findMany({
    where: {
      status: "AWAITING_PICKUP",
      OR: [
        // Orders with a scheduled time that has passed the timeout window
        { scheduledFor: { lt: cutoff } },
        // Orders without a scheduled time that have been in AWAITING_PICKUP too long (use updatedAt as proxy)
        { scheduledFor: null, updatedAt: { lt: cutoff } },
      ],
    },
    select: { id: true },
    // @ts-expect-error _bypassTenancyCheck is custom middleware flag
    _bypassTenancyCheck: true,
  });

  let swept = 0;
  let errors = 0;

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

  return NextResponse.json({ swept, errors });
}
