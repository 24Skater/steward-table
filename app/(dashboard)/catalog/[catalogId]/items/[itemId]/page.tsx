import { ItemModifiersManager } from "@/components/item-modifiers";
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";

export default async function ItemModifiersPage({
  params,
}: {
  params: Promise<{ catalogId: string; itemId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const { catalogId, itemId } = await params;

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const item = await db.item.findFirst({
    where: { id: itemId, churchId: membership.churchId, deletedAt: null },
    include: {
      modifierGroups: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
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
      },
    },
  });

  if (!item) notFound();

  // Reshape the Prisma result to match the component interface
  const shapedItem = {
    id: item.id,
    name: item.name,
    modifierGroups: item.modifierGroups.map((binding) => ({
      id: binding.id,
      sortOrder: binding.sortOrder,
      overrideIsRequired: binding.overrideIsRequired ?? null,
      overrideMin: binding.overrideMin ?? null,
      overrideMax: binding.overrideMax ?? null,
      modifierGroup: {
        id: binding.group.id,
        name: binding.group.name,
        defaultIsRequired: binding.group.defaultIsRequired,
        defaultMinSelections: binding.group.defaultMinSelections,
        defaultMaxSelections: binding.group.defaultMaxSelections,
        options: binding.group.options.map((opt) => ({
          id: opt.id,
          name: opt.name,
          priceDelta: opt.priceDelta,
        })),
      },
    })),
  };

  return (
    <main className="p-6">
      <ItemModifiersManager
        item={shapedItem}
        catalogId={catalogId}
        churchId={membership.churchId}
      />
    </main>
  );
}
