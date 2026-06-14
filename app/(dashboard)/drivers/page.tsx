import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { TopBar } from "@/components/layout/top-bar";
import { DriversPage } from "@/components/drivers";
import type { DeliveryOrderCardData, DriverOption } from "@/components/drivers";
import type { SessionMembership } from "@/lib/auth/types";
import type { OrderStatus } from "@prisma/client";

// Active statuses for delivery orders shown on this page
const ACTIVE_DELIVERY_STATUSES: OrderStatus[] = [
  "CONFIRMED",
  "IN_KITCHEN",
  "READY",
  "OUT_FOR_DELIVERY",
];

export default async function DriversPageRoute() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const { churchId } = membership;

  // Check if the current user can assign drivers (order.update = STAFF+)
  const assignResult = await can("order.update", {
    userId: session.user.id,
    churchId,
    roles: membership.roles,
  });

  // DRIVER role can only see their own deliveries (order.read restriction).
  // Non-STAFF, non-DRIVER users have no business on this page.
  const orderReadResult = await can("order.read", {
    userId: session.user.id,
    churchId,
    roles: membership.roles,
  });
  if (!orderReadResult.allowed) redirect("/");

  const isDriver = membership.roles.includes("DRIVER");
  const canAssign = assignResult.allowed;

  const [rawOrders, rawDrivers] = await Promise.all([
    // Fetch active DELIVERY orders
    (db.order.findMany as PrismaBypass)({
      where: {
        churchId,
        fulfillment: "DELIVERY",
        status: { in: ACTIVE_DELIVERY_STATUSES },
        ...(isDriver && !canAssign
          ? {
              // DRIVER sees only their assigned orders
              deliveryInfo: { driverId: session.user.id },
            }
          : {}),
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        number: true,
        status: true,
        customer: { select: { name: true } },
        deliveryInfo: {
          select: {
            id: true,
            recipientName: true,
            line1: true,
            city: true,
            driverId: true,
          },
        },
      },
      _bypassTenancyCheck: true,
    }) as Promise<
      Array<{
        id: string;
        number: number;
        status: OrderStatus;
        customer: { name: string };
        deliveryInfo: {
          id: string;
          recipientName: string;
          line1: string;
          city: string;
          driverId: string | null;
        } | null;
      }>
    >,

    // Fetch all active DRIVER members of this church
    canAssign
      ? (db.membership.findMany as PrismaBypass)({
          where: {
            churchId,
            status: "ACTIVE",
            roles: { has: "DRIVER" },
          },
          select: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
          _bypassTenancyCheck: true,
        })
      : Promise.resolve([]),
  ]);

  const orders: DeliveryOrderCardData[] = rawOrders.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    customer: { name: o.customer.name },
    deliveryInfo: o.deliveryInfo,
  }));

  const drivers: DriverOption[] = (
    rawDrivers as Array<{ user: { id: string; name: string | null } }>
  ).map((m) => ({
    id: m.user.id,
    name: m.user.name,
  }));

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Drivers" />
      <DriversPage orders={orders} drivers={drivers} canAssign={canAssign} />
    </div>
  );
}
