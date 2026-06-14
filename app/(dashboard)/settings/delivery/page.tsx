import { TopBar } from "@/components/layout/top-bar";
import { DeliveryZonesManager } from "@/components/settings/delivery-zones-manager";
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { redirect } from "next/navigation";

export default async function DeliverySettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const result = await can("church.update", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) redirect("/settings");

  const zones = await (db.deliveryZone.findMany as PrismaBypass)({
    where: { churchId: membership.churchId },
    select: {
      id: true,
      name: true,
      postalCodes: true,
      feeCents: true,
      minOrderCents: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Delivery Zones" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">Delivery zones</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Define which postal codes you deliver to, and the fees that apply.
            </p>
          </div>
          <DeliveryZonesManager initialZones={zones} />
        </div>
      </div>
    </div>
  );
}
