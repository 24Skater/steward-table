import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { TopBar } from "@/components/layout/top-bar";
import { ModifierGroupsManager } from "@/components/modifier-groups/modifier-groups-manager";
import type { SessionMembership } from "@/lib/auth/types";

export default async function ModifierGroupsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const canResult = await can("catalog.edit", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!canResult.allowed) redirect("/");

  const groups = await db.modifierGroup.findMany({
    where: { churchId: membership.churchId, deletedAt: null },
    select: {
      id: true,
      name: true,
      defaultMinSelections: true,
      defaultMaxSelections: true,
      defaultIsRequired: true,
      options: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          priceDelta: true,
          isDefault: true,
          sortOrder: true,
        },
      },
      _count: {
        select: { itemBindings: { where: { deletedAt: null } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Modifier Groups" />
      <div className="flex-1 overflow-y-auto p-6">
        <ModifierGroupsManager
          groups={groups}
          churchId={membership.churchId}
        />
      </div>
    </div>
  );
}
