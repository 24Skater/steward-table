"use client";

import { ItemCard } from "@/components/storefront/item-card";

interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  options: ModifierOption[];
}

export interface MenuItemData {
  itemId: string;
  catalogId: string;
  name: string;
  description: string | null;
  price: number;
  modifierGroups: ModifierGroup[];
}

interface MenuPageProps {
  catalogName: string;
  catalogDescription: string | null;
  items: MenuItemData[];
}

export function MenuPage({ catalogName, catalogDescription, items }: MenuPageProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <p className="text-lg font-medium">No items available right now.</p>
        <p className="mt-1 text-sm">Check back soon.</p>
      </div>
    );
  }

  return (
    <div>
      {catalogDescription && (
        <p className="mb-6 text-slate-500">{catalogDescription}</p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <ItemCard key={item.itemId} {...item} />
        ))}
      </div>
    </div>
  );
}
