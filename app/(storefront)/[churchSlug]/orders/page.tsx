import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

interface OrderHistoryPageProps {
  params: Promise<{ churchSlug: string }>;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Received",
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

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-blue-50 text-blue-700",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  IN_KITCHEN: "bg-amber-50 text-amber-700",
  READY: "bg-emerald-100 text-emerald-800",
  AWAITING_PICKUP: "bg-emerald-100 text-emerald-800",
  PICKED_UP: "bg-slate-100 text-slate-600",
  OUT_FOR_DELIVERY: "bg-blue-50 text-blue-700",
  DELIVERED: "bg-slate-100 text-slate-600",
  SERVED: "bg-slate-100 text-slate-600",
  COMPLETED: "bg-slate-100 text-slate-600",
  CANCELED: "bg-red-50 text-red-600",
  REFUNDED: "bg-orange-50 text-orange-700",
};

export default async function OrderHistoryPage({
  params,
}: OrderHistoryPageProps) {
  const { churchSlug } = await params;
  const session = await auth();

  const church = await db.church.findFirst({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: { id: true, name: true },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore bypass tenancy for public storefront church lookup
    _bypassTenancyCheck: true,
  });

  if (!church) {
    notFound();
  }

  if (!session?.user) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="mb-2 text-2xl font-bold text-slate-800">Your Orders</h1>
        <p className="mb-6 text-slate-500">
          Sign in to view your order history at {church.name}.
        </p>
        <Link
          href="/auth/sign-in"
          className="inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Sign in
        </Link>
      </div>
    );
  }

  // Look up customer by userId (covers both email and phone-based magic-link sessions)
  // Fall back to email lookup for backwards compatibility
  const userId = (session.user as { id?: string }).id;
  const email = session.user.email;

  const customer = await db.customer.findFirst({
    where: {
      churchId: church.id,
      ...(userId
        ? { userId }
        : email
        ? { emailNormalized: email.toLowerCase() }
        : { id: "never" }),
    },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          items: { select: { itemName: true, quantity: true } },
        },
      },
    },
    ...({ _bypassTenancyCheck: true } as object),
  });

  if (!customer || customer.orders.length === 0) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="mb-2 text-2xl font-bold text-slate-800">Your Orders</h1>
        <p className="text-slate-500">
          You haven&apos;t placed any orders at {church.name} yet.
        </p>
        <div className="mt-6">
          <Link
            href={`/${churchSlug}/menu`}
            className="text-sm text-emerald-600 underline-offset-2 hover:underline"
          >
            Browse the menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Your Orders</h1>

      <ul className="space-y-3">
        {customer.orders.map((order) => {
          const statusLabel = STATUS_LABELS[order.status] ?? order.status;
          const statusColor =
            STATUS_COLORS[order.status] ?? "bg-slate-100 text-slate-600";
          const itemSummary = order.items
            .map((item) => `${item.quantity}x ${item.itemName}`)
            .join(", ");

          return (
            <li key={order.id}>
              <Link
                href={`/${churchSlug}/order/${order.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    Order #{order.number}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    {formatDate(order.createdAt)}
                  </p>
                  <p className="text-sm font-semibold text-slate-700">
                    {formatCents(order.total)}
                  </p>
                </div>

                {itemSummary && (
                  <p className="mt-1.5 truncate text-sm text-slate-400">
                    {itemSummary}
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
