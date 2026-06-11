"use client";

import { useState } from "react";
import { Search } from "lucide-react";
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

export function MenuPage({ catalogName: _catalogName, catalogDescription, items }: MenuPageProps) {
  const [query, setQuery] = useState("");

  const filtered =
    query.trim() === ""
      ? items
      : items.filter((item) =>
          item.name.toLowerCase().includes(query.toLowerCase()),
        );

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
        <p className="mb-4 text-slate-500">{catalogDescription}</p>
      )}

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <p className="text-sm">No items match &ldquo;{query}&rdquo;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <ItemCard key={item.itemId} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}
