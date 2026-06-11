import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { TopBar } from "@/components/layout/top-bar";
import { MenuManager } from "@/components/menu/menu-manager";
import type { SessionMembership } from "@/lib/auth/types";

export default async function MenuPage() {
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

  const catalogs = await (db.catalog.findMany as Function)({
    where: { churchId: membership.churchId, deletedAt: null },
    include: {
      items: {
        where: { deletedAt: null },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              description: true,
              defaultPrice: true,
              imageUrl: true,
              status: true,
              _count: { select: { modifierGroups: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Menu" />
      <div className="flex-1 overflow-y-auto p-6">
        <MenuManager
          catalogs={catalogs}
          churchId={membership.churchId}
        />
      </div>
    </div>
  );
}
