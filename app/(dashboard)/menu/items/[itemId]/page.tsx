import { ItemEditPage } from "@/components/menu/item-edit-page";
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { redirect } from "next/navigation";

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

  const item = await (db.item.findFirst as PrismaBypass)({
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
    // translations is already included via the main model select (Prisma
    // returns all scalar fields by default with `include`; explicit select
    // would require listing every field, so we rely on the default).
  });

  if (!item) redirect("/menu");

  return <ItemEditPage item={item} />;
}
