import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac/can";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/top-bar";
import { CustomersPage } from "@/components/customers";
import type { CustomerRow } from "@/components/customers";

interface CustomersPageRouteProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function CustomersPageRoute({ searchParams }: CustomersPageRouteProps) {
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

  const permission = await can("customer.read", {
    userId: session.user.id,
    churchId,
    roles,
  });
  if (!permission.allowed) {
    redirect("/");
  }

  const { q } = await searchParams;
  const searchQuery = q?.trim() ?? "";

  const where = {
    churchId,
    ...(searchQuery
      ? {
          OR: [
            { name: { contains: searchQuery, mode: "insensitive" as const } },
            { email: { contains: searchQuery, mode: "insensitive" as const } },
            { phone: { contains: searchQuery } },
          ],
        }
      : {}),
  };

  const raw = await db.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      totalOrders: true,
      lifetimeValueCents: true,
      orders: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const customers: CustomerRow[] = raw.map(
    (c: (typeof raw)[number]) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? null,
      email: c.email ?? null,
      totalOrders: c.totalOrders,
      lifetimeValueCents: c.lifetimeValueCents,
      lastOrderAt: c.orders[0]?.createdAt ?? null,
    }),
  );

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Customers" />
      <CustomersPage customers={customers} initialSearch={searchQuery} />
    </div>
  );
}
