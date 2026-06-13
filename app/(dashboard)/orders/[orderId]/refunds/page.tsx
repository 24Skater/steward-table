import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/top-bar";
import { Badge } from "@/components/ui/badge";
import type { RefundStatus } from "@prisma/client";

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function RefundStatusBadge({ status }: { status: RefundStatus }) {
  const variantMap: Record<RefundStatus, { label: string; className: string }> = {
    COMPLETED: { label: "Completed", className: "bg-green-50 text-green-700 border-green-200" },
    PENDING:   { label: "Pending",   className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    FAILED:    { label: "Failed",    className: "bg-red-50 text-red-700 border-red-200" },
  };

  const { label, className } = variantMap[status];

  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      {label}
    </Badge>
  );
}

export default async function RefundsPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const { orderId } = await params;

  const activeMembership = session.user.memberships?.find(
    (m) => m.status === "ACTIVE",
  );
  if (!activeMembership) redirect("/auth/sign-in");

  const { churchId } = activeMembership;

  // Confirm the order belongs to this church
  const order = await (db.order.findFirst as Function)({
    where: { id: orderId, churchId },
    select: { id: true, number: true },
    _bypassTenancyCheck: true,
  }) as { id: string; number: number } | null;

  if (!order) notFound();

  const refunds = await (db.refund.findMany as Function)({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    include: {
      actor: { select: { name: true } },
    },
    _bypassTenancyCheck: true,
  }) as Array<{
    id: string;
    amount: number;
    reason: string;
    status: RefundStatus;
    externalId: string | null;
    createdAt: Date;
    actor: { name: string | null } | null;
  }>;

  return (
    <div className="flex flex-col h-full">
      <TopBar title={`Order #${order.number} — Refunds`} />

      <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-6">
        {/* Back link */}
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M8.5 2.5L4 7l4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to order
        </Link>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          {refunds.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-slate-500">No refunds have been issued for this order.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Date
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Reason
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Issued by
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Stripe ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {refunds.map((refund) => (
                  <tr key={refund.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-slate-700 tabular-nums whitespace-nowrap">
                      {formatDate(refund.createdAt)}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-800 tabular-nums whitespace-nowrap">
                      {formatPrice(refund.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <RefundStatusBadge status={refund.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-600 max-w-xs truncate">
                      {refund.reason}
                    </td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                      {refund.actor?.name ?? "System"}
                    </td>
                    <td className="px-5 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">
                      {refund.externalId ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
