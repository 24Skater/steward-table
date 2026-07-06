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

  interface RawOption {
    id: string;
    name: string;
    priceDelta: number;
    isDefault: boolean;
  }
  interface RawItemModifierGroup {
    overrideMin: number | null;
    overrideMax: number | null;
    overrideIsRequired: boolean | null;
    group: {
      id: string;
      name: string;
      translations: unknown;
      defaultMinSelections: number;
      defaultMaxSelections: number;
      defaultIsRequired: boolean;
      options: RawOption[];
    };
  }
  interface RawCatalogItem {
    priceOverride: number | null;
    isAvailable: boolean | null;
    maxQuantityPerOrder: number | null;
    item: {
      id: string;
      name: string;
      translations: unknown;
      description: string | null;
      defaultPrice: number;
      station: string | null;
      imageUrl: string | null;
      modifierGroups: RawItemModifierGroup[];
    };
  }

  const items: MenuItemData[] = (catalog.items as unknown as RawCatalogItem[]).map((ci) => ({
    itemId: ci.item.id,
    catalogId: catalog.id as string,
    name: translate(ci.item.name, ci.item.translations, locale),
    description:
      ci.item.description != null
        ? translate(ci.item.description, ci.item.translations, locale, "description")
        : null,
    price: ci.priceOverride ?? ci.item.defaultPrice,
    category: ci.item.station ?? null,
    imageUrl: ci.item.imageUrl ?? null,
    isAvailable: ci.isAvailable ?? true,
    maxQuantityPerOrder: ci.maxQuantityPerOrder ?? null,
    modifierGroups: ci.item.modifierGroups.map((img) => ({
      id: img.group.id,
      name: translate(img.group.name, img.group.translations, locale),
      minSelections: img.overrideMin ?? img.group.defaultMinSelections,
      maxSelections: img.overrideMax ?? img.group.defaultMaxSelections,
      isRequired: img.overrideIsRequired ?? img.group.defaultIsRequired,
      options: img.group.options.map((o) => ({
        id: o.id,
        name: o.name,
        priceDelta: o.priceDelta,
        isDefault: o.isDefault,
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
