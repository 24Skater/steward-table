import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/top-bar";
import { InventoryPage } from "@/components/inventory";
import type { InventoryRow } from "@/components/inventory";

export default async function InventoryPageRoute() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const activeMembership = session.user.memberships?.find(
    (m) => m.status === "ACTIVE",
  );
  if (!activeMembership) {
    redirect("/auth/sign-in");
  }

  const { churchId } = activeMembership;

  const raw = await db.inventoryItem.findMany({
    where: { churchId, deletedAt: null },
    include: {
      item: {
        select: { name: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const items: InventoryRow[] = raw.map((inv: (typeof raw)[number]) => ({
    id: inv.id,
    itemId: inv.itemId,
    itemName: inv.item.name,
    quantityOnHand: inv.quantityOnHand,
    lowStockThreshold: inv.lowStockThreshold ?? null,
    trackingEnabled: inv.trackingEnabled,
    updatedAt: inv.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Inventory" />
      <InventoryPage churchId={churchId} initialItems={items} />
    </div>
  );
}
