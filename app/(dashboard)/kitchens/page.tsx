import { KitchenManager } from "@/components/kitchens/kitchen-manager";
import { TopBar } from "@/components/layout/top-bar";
import { requireActiveMembership } from "@/lib/auth/helpers";
import { db } from "@/lib/db";

export default async function KitchensPage() {
  const { membership } = await requireActiveMembership();

  const kitchens = await db.kitchen.findMany({
    where: { churchId: membership.churchId },
    select: {
      id: true,
      name: true,
      slug: true,
      isDefault: true,
      _count: { select: { catalogs: true } },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  const initialKitchens = kitchens.map((k) => ({
    id: k.id,
    name: k.name,
    slug: k.slug,
    isDefault: k.isDefault,
    catalogCount: k._count.catalogs,
  }));

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Kitchens" />
      <KitchenManager initialKitchens={initialKitchens} />
    </div>
  );
}
