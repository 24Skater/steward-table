import { notFound } from "next/navigation";
import { requireActiveMembership } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/top-bar";
import { CatalogAssignment } from "@/components/kitchens/catalog-assignment";

export default async function KitchenEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { membership } = await requireActiveMembership();
  const { id } = await params;
  const churchId = membership.churchId;

  const kitchen = await db.kitchen.findFirst({
    where: { id, churchId },
    select: { id: true, name: true, isDefault: true },
  });
  if (!kitchen) notFound();

  const catalogs = await db.catalog.findMany({
    where: { churchId },
    select: { id: true, name: true, kitchenId: true },
    orderBy: { name: "asc" },
  });

  const options = catalogs.map((c) => ({
    id: c.id,
    name: c.name,
    assignedToThis: c.kitchenId === kitchen.id,
    assignedElsewhere: c.kitchenId !== null && c.kitchenId !== kitchen.id,
  }));

  return (
    <div className="flex flex-col h-full">
      <TopBar title={`Kitchen · ${kitchen.name}`} />
      <CatalogAssignment
        kitchenId={kitchen.id}
        isDefault={kitchen.isDefault}
        catalogs={options}
      />
    </div>
  );
}
