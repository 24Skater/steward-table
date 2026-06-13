import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SessionMembership } from "@/lib/auth/types";
import type { OrderStatus, FulfillmentType } from "@prisma/client";
import { DriverHome } from "@/components/drivers/driver-home";

export interface AssignedDelivery {
  id: string;
  number: number;
  status: "READY" | "OUT_FOR_DELIVERY";
  scheduledFor: string | null;
  customerName: string;
  customerPhone: string | null;
  items: Array<{ itemName: string; quantity: number }>;
  deliveryInfo: {
    recipientName: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string;
    postalCode: string;
    instructions: string | null;
  } | null;
}

export interface AvailableDelivery {
  id: string;
  number: number;
  scheduledFor: string | null;
  itemCount: number;
  city: string | null;
}

const DRIVER_VISIBLE_STATUSES: OrderStatus[] = ["READY", "OUT_FOR_DELIVERY"];

export default async function DriverPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const churchId = membership.churchId;
  const userId = session.user.id;

  const [rawAssigned, rawAvailable] = await Promise.all([
    // Deliveries assigned to this driver
    (db.deliveryInfo.findMany as Function)({
      where: {
        driverId: userId,
        order: {
          churchId,
          status: { in: DRIVER_VISIBLE_STATUSES },
        },
      },
      select: {
        recipientName: true,
        line1: true,
        line2: true,
        city: true,
        region: true,
        postalCode: true,
        instructions: true,
        order: {
          select: {
            id: true,
            number: true,
            status: true,
            scheduledFor: true,
            customer: { select: { name: true, phone: true } },
            items: { select: { itemName: true, quantity: true } },
          },
        },
      },
      orderBy: { order: { createdAt: "asc" } },
      _bypassTenancyCheck: true,
    }),

    // Unassigned delivery orders that are READY
    (db.order.findMany as Function)({
      where: {
        churchId,
        fulfillment: "DELIVERY" as FulfillmentType,
        status: "READY" as OrderStatus,
        deliveryInfo: { driverId: null },
      },
      select: {
        id: true,
        number: true,
        scheduledFor: true,
        items: { select: { id: true } },
        deliveryInfo: { select: { city: true } },
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      _bypassTenancyCheck: true,
    }),
  ]) as [
    Array<{
      recipientName: string;
      line1: string;
      line2: string | null;
      city: string;
      region: string;
      postalCode: string;
      instructions: string | null;
      order: {
        id: string;
        number: number;
        status: OrderStatus;
        scheduledFor: Date | null;
        customer: { name: string; phone: string | null };
        items: Array<{ itemName: string; quantity: number }>;
      };
    }>,
    Array<{
      id: string;
      number: number;
      scheduledFor: Date | null;
      items: Array<{ id: string }>;
      deliveryInfo: { city: string } | null;
    }>,
  ];

  const assigned: AssignedDelivery[] = rawAssigned
    .map((d) => ({
      id: d.order.id,
      number: d.order.number,
      status: d.order.status as "READY" | "OUT_FOR_DELIVERY",
      scheduledFor: d.order.scheduledFor?.toISOString() ?? null,
      customerName: d.order.customer.name,
      customerPhone: d.order.customer.phone,
      items: d.order.items,
      deliveryInfo: {
        recipientName: d.recipientName,
        line1: d.line1,
        line2: d.line2,
        city: d.city,
        region: d.region,
        postalCode: d.postalCode,
        instructions: d.instructions,
      },
    }))
    .sort((a, b) => {
      if (a.status === "OUT_FOR_DELIVERY" && b.status !== "OUT_FOR_DELIVERY") return -1;
      if (b.status === "OUT_FOR_DELIVERY" && a.status !== "OUT_FOR_DELIVERY") return 1;
      return 0;
    });

  const available: AvailableDelivery[] = rawAvailable.map((o) => ({
    id: o.id,
    number: o.number,
    scheduledFor: o.scheduledFor?.toISOString() ?? null,
    itemCount: o.items.length,
    city: o.deliveryInfo?.city ?? null,
  }));

  return <DriverHome assigned={assigned} available={available} />;
}
