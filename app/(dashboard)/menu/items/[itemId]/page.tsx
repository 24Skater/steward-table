import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { ItemEditPage } from "@/components/menu/item-edit-page";
import type { SessionMembership } from "@/lib/auth/types";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
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

  const { itemId } = await params;

  const item = await (db.item.findFirst as Function)({
    where: { id: itemId, churchId: membership.churchId, deletedAt: null },
    include: {
      catalogItems: {
        where: { deletedAt: null },
        include: {
          catalog: { select: { id: true, name: true } },
        },
      },
      modifierGroups: {
        where: { deletedAt: null },
        include: {
          group: {
            include: {
              options: {
                where: { deletedAt: null },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!item) redirect("/menu");

  return <ItemEditPage item={item} />;
}
