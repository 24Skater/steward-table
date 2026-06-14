import { MenuPage } from "@/components/storefront/menu-page";
import type { MenuItemData } from "@/components/storefront/menu-page";
import { db } from "@/lib/db";
import { translate } from "@/lib/i18n/translate";
import { notFound } from "next/navigation";

interface CatalogPageProps {
  params: Promise<{ churchSlug: string; catalogId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CatalogPage({ params, searchParams }: CatalogPageProps) {
  const { churchSlug, catalogId } = await params;
  const resolvedSearch = await searchParams;
  const langParam =
    typeof resolvedSearch.lang === "string" ? resolvedSearch.lang.toUpperCase() : null;

  const church = await db.church.findFirst({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: { id: true, locale: true },
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
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        select: {
          isAvailable: true,
          priceOverride: true,
          maxQuantityPerOrder: true,
          item: {
            select: {
              id: true,
              name: true,
              description: true,
              defaultPrice: true,
              station: true,
              imageUrl: true,
              translations: true,
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

  const churchDefault: "EN" | "ES" = (church.locale as string) === "ES" ? "ES" : "EN";
  const locale: "EN" | "ES" = langParam === "EN" || langParam === "ES" ? langParam : churchDefault;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: MenuItemData[] = (catalog.items as any[]).map((ci: any) => ({
    itemId: ci.item.id as string,
    catalogId: catalog.id as string,
    name: translate(ci.item.name as string, ci.item.translations, locale),
    description:
      ci.item.description != null
        ? translate(ci.item.description as string, ci.item.translations, locale, "description")
        : null,
    price: (ci.priceOverride ?? ci.item.defaultPrice) as number,
    category: (ci.item.station as string | null) ?? null,
    imageUrl: (ci.item.imageUrl as string | null) ?? null,
    isAvailable: (ci.isAvailable as boolean) ?? true,
    maxQuantityPerOrder: (ci.maxQuantityPerOrder as number | null) ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modifierGroups: (ci.item.modifierGroups as any[]).map((img: any) => ({
      id: img.group.id as string,
      name: translate(img.group.name as string, img.group.translations, locale),
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

  const categories: string[] = Array.from(
    new Set(items.map((item) => item.category).filter((c): c is string => c !== null)),
  );

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-800">{catalog.name}</h1>
      <MenuPage
        catalogName={catalog.name}
        catalogDescription={catalog.description}
        items={items}
        categories={categories}
      />
    </div>
  );
}
