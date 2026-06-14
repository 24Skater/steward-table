import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

interface CompletedDelivery {
  id: string;
  number: number;
  deliveredAt: string;
  recipientName: string;
  city: string;
  itemCount: number;
}

export default async function DriverHistoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const churchId = membership.churchId;
  const userId = session.user.id;

  const rawCompleted = (await (db.deliveryInfo.findMany as PrismaBypass)({
    where: {
      driverId: userId,
      order: {
        churchId,
        status: "DELIVERED" as OrderStatus,
      },
    },
    select: {
      recipientName: true,
      city: true,
      order: {
        select: {
          id: true,
          number: true,
          updatedAt: true,
          items: { select: { id: true } },
        },
      },
    },
    orderBy: { order: { updatedAt: "desc" } },
    take: 50,
    _bypassTenancyCheck: true,
  })) as Array<{
    recipientName: string;
    city: string;
    order: {
      id: string;
      number: number;
      updatedAt: Date;
      items: Array<{ id: string }>;
    };
  }>;

  const deliveries: CompletedDelivery[] = rawCompleted.map((d) => ({
    id: d.order.id,
    number: d.order.number,
    deliveredAt: d.order.updatedAt.toISOString(),
    recipientName: d.recipientName,
    city: d.city,
    itemCount: d.order.items.length,
  }));

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/d" className="text-sm text-slate-500 hover:text-slate-700">
          ← Back
        </Link>
        <h1 className="text-xl font-bold text-slate-800">Delivery History</h1>
      </div>

      {deliveries.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No completed deliveries yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {deliveries.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-slate-200 bg-white px-4 py-4 flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">Order #{d.number}</p>
                <p className="text-sm text-slate-500 mt-0.5 truncate">
                  {d.recipientName}
                  {d.city ? ` · ${d.city}` : ""}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {d.itemCount} {d.itemCount === 1 ? "item" : "items"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  Delivered
                </span>
                <p className="text-xs text-slate-400 mt-1">
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(d.deliveredAt))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
