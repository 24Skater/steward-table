import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac/can";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/top-bar";
import { CustomerDetailPage } from "@/components/customers/customer-detail-page";
import type { CustomerDetailData } from "@/components/customers/customer-detail-page";

export default async function CustomerDetailRoute({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const activeMembership = session.user.memberships?.find(
    (m) => m.status === "ACTIVE",
  );
  if (!activeMembership) {
    redirect("/auth/sign-in");
  }

  const { churchId, roles } = activeMembership;

  const permission = await can("order.read", {
    userId: session.user.id,
    churchId,
    roles,
  });
  if (!permission.allowed) {
    redirect("/");
  }

  const { customerId } = await params;

  const raw = await (db.customer.findFirst as Function)({
    where: { id: customerId, churchId: churchId },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          items: { select: { itemName: true, quantity: true, subtotal: true } },
          _count: { select: { items: true } },
        },
      },
    },
  }) as {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    smsOptIn: boolean;
    notes: string | null;
    createdAt: Date;
    orders: Array<{
      id: string;
      number: number;
      status: string;
      total: number;
      createdAt: Date;
      items: Array<{ itemName: string; quantity: number; subtotal: number }>;
      _count: { items: number };
    }>;
  } | null;

  if (!raw) {
    redirect("/customers");
  }

  const totalSpentCents = raw.orders.reduce((sum, o) => sum + o.total, 0);
  const avgOrderCents =
    raw.orders.length > 0 ? Math.round(totalSpentCents / raw.orders.length) : 0;

  const customer: CustomerDetailData = {
    id: raw.id,
    name: raw.name,
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    smsOptIn: raw.smsOptIn,
    notes: raw.notes ?? null,
    createdAt: raw.createdAt,
    stats: {
      totalOrders: raw.orders.length,
      totalSpentCents,
      avgOrderCents,
    },
    orders: raw.orders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      total: o.total,
      createdAt: o.createdAt,
      itemCount: o._count.items,
      items: o.items,
    })),
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title={raw.name} />
      <CustomerDetailPage customer={customer} />
    </div>
  );
}
