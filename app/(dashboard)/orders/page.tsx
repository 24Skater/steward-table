import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/top-bar";
import { OrdersPage } from "@/components/orders";
import type { OrderRowData } from "@/components/orders";

export default async function OrdersPageRoute() {
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

  const { churchId } = activeMembership;

  const raw = await db.order.findMany({
    where: { churchId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      number: true,
      status: true,
      fulfillment: true,
      createdAt: true,
      scheduledFor: true,
      customer: {
        select: { name: true },
      },
      _count: {
        select: { items: true },
      },
    },
  });

  // Dates arrive as Date objects from Prisma; pass as-is (serialized by Next.js)
  const orders: OrderRowData[] = raw.map((o: (typeof raw)[number]) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    fulfillment: o.fulfillment,
    createdAt: o.createdAt,
    scheduledFor: o.scheduledFor,
    customer: { name: o.customer.name },
    _count: { items: o._count.items },
  }));

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Orders" />
      <OrdersPage orders={orders} />
    </div>
  );
}
