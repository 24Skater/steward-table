import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { MenuPage } from "@/components/storefront/menu-page";
import type { MenuItemData } from "@/components/storefront/menu-page";

interface CatalogPageProps {
  params: Promise<{ churchSlug: string; catalogId: string }>;
}

export default async function CatalogPage({ params }: CatalogPageProps) {
  const { churchSlug, catalogId } = await params;

  const church = await db.church.findFirst({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: { id: true },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore bypass tenancy for storefront
    _bypassTenancyCheck: true,
  });

  if (!church) {
    notFound();
  }

  const catalog = await db.catalog.findFirst({
    where: { id: catalogId, churchId: church.id, status: "OPEN" },
    select: {
      id: true,
      name: true,
      description: true,
      items: {
        where: { isAvailable: true, deletedAt: null },
        orderBy: { sortOrder: "asc" },
        select: {
          priceOverride: true,
          item: {
            select: {
              id: true,
              name: true,
              description: true,
              defaultPrice: true,
              modifierGroups: {
                where: { deletedAt: null },
                orderBy: { sortOrder: "asc" },
                select: {
                  overrideMin: true,
                  overrideMax: true,
                  overrideIsRequired: true,
                  group: {
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
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!catalog) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: MenuItemData[] = (catalog.items as any[]).map((ci: any) => ({
    itemId: ci.item.id as string,
    catalogId: catalog.id as string,
    name: ci.item.name as string,
    description: ci.item.description as string | null,
    price: (ci.priceOverride ?? ci.item.defaultPrice) as number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modifierGroups: (ci.item.modifierGroups as any[]).map((img: any) => ({
      id: img.group.id as string,
      name: img.group.name as string,
      minSelections: (img.overrideMin ?? img.group.defaultMinSelections) as number,
      maxSelections: (img.overrideMax ?? img.group.defaultMaxSelections) as number,
      isRequired: (img.overrideIsRequired ?? img.group.defaultIsRequired) as boolean,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      options: (img.group.options as any[]).map((o: any) => ({
        id: o.id as string,
        name: o.name as string,
        priceDelta: o.priceDelta as number,
        isDefault: o.isDefault as boolean,
      })),
    })),
  }));

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-800">{catalog.name}</h1>
      <MenuPage
        catalogName={catalog.name}
        catalogDescription={catalog.description}
        items={items}
      />
    </div>
  );
}
