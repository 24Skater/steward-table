import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/top-bar";
import { OrderDetail } from "@/components/orders/order-detail";
import type { OrderDetailData, AuditLogEntry } from "@/components/orders/order-detail";

export default async function OrderDetailPage({
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

  const raw = await db.order.findFirst({
    where: { id: orderId, churchId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
      },
      events: {
        orderBy: { createdAt: "asc" },
        include: {
          actor: {
            select: { name: true },
          },
        },
      },
      deliveryInfo: true,
    },
  });

  if (!raw) notFound();

  const auditRaw = await db.auditLog.findMany({
    where: {
      churchId,
      resource: "Order",
      resourceId: orderId,
    },
    orderBy: { createdAt: "asc" },
    include: {
      actor: {
        select: { name: true },
      },
    },
  });

  const order: OrderDetailData = {
    id: raw.id,
    number: raw.number,
    status: raw.status,
    fulfillment: raw.fulfillment,
    channel: raw.channel,
    currency: raw.currency,
    subtotal: raw.subtotal,
    tax: raw.tax,
    tip: raw.tip,
    total: raw.total,
    notes: raw.notes,
    scheduledFor: raw.scheduledFor,
    createdAt: raw.createdAt,
    customer: {
      id: raw.customer.id,
      name: raw.customer.name,
      email: raw.customer.email,
      phone: raw.customer.phone,
    },
    items: raw.items.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
      total: item.total,
      modifierSnapshot: item.modifierSnapshot,
    })),
    events: raw.events.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      reason: event.reason,
      actorId: event.actorId,
      createdAt: event.createdAt,
      actor: event.actor,
    })),
    deliveryInfo: raw.deliveryInfo
      ? {
          recipientName: raw.deliveryInfo.recipientName,
          phone: raw.deliveryInfo.phone,
          line1: raw.deliveryInfo.line1,
          line2: raw.deliveryInfo.line2,
          city: raw.deliveryInfo.city,
          region: raw.deliveryInfo.region,
          postalCode: raw.deliveryInfo.postalCode,
          country: raw.deliveryInfo.country,
          instructions: raw.deliveryInfo.instructions,
        }
      : null,
  };

  const auditLogs: AuditLogEntry[] = auditRaw.map((log) => ({
    id: log.id,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    actorId: log.actorId,
    createdAt: log.createdAt,
    actor: log.actor,
  }));

  return (
    <div className="flex flex-col h-full">
      <TopBar title={`Order #${raw.number}`} />
      <OrderDetail order={order} auditLogs={auditLogs} />
    </div>
  );
}
