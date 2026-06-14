import { DriverDeliveryDetail } from "@/components/drivers/driver-delivery-detail";
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

interface DriverOrderPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function DriverOrderPage({ params }: DriverOrderPageProps) {
  const { orderId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const churchId = membership.churchId;
  const userId = session.user.id;

  const deliveryInfo = await (db.deliveryInfo.findFirst as PrismaBypass)({
    where: {
      driverId: userId,
      order: { churchId, id: orderId },
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
          notes: true,
          customer: { select: { name: true, phone: true } },
          items: {
            select: {
              itemName: true,
              quantity: true,
              modifierSnapshot: true,
            },
          },
        },
      },
    },
    _bypassTenancyCheck: true,
  });

  if (!deliveryInfo) {
    notFound();
  }

  const order = deliveryInfo.order as {
    id: string;
    number: number;
    status: string;
    notes: string | null;
    customer: { name: string; phone: string | null };
    items: Array<{ itemName: string; quantity: number; modifierSnapshot: unknown }>;
  };

  if (order.status !== "READY" && order.status !== "OUT_FOR_DELIVERY") {
    redirect("/d");
  }

  const info = {
    recipientName: deliveryInfo.recipientName as string,
    line1: deliveryInfo.line1 as string,
    line2: deliveryInfo.line2 as string | null,
    city: deliveryInfo.city as string,
    region: deliveryInfo.region as string,
    postalCode: deliveryInfo.postalCode as string,
    instructions: deliveryInfo.instructions as string | null,
  };

  const items = order.items.map((item) => {
    const mods = Array.isArray(item.modifierSnapshot)
      ? (item.modifierSnapshot as Array<{ groupName: string; optionName: string }>)
      : [];
    return {
      itemName: item.itemName,
      quantity: item.quantity,
      modifiers: mods,
    };
  });

  const fullAddress = [info.line1, info.line2, `${info.city}, ${info.region} ${info.postalCode}`]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <Link
        href="/d"
        className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        ← Back to list
      </Link>

      <DriverDeliveryDetail
        orderId={order.id}
        orderNumber={order.number}
        status={order.status as "READY" | "OUT_FOR_DELIVERY"}
        customerName={order.customer.name}
        customerPhone={order.customer.phone}
        recipientName={info.recipientName}
        fullAddress={fullAddress}
        instructions={info.instructions}
        kitchenNotes={order.notes}
        items={items}
      />
    </div>
  );
}
