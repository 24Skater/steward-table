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
  category: string | null;
  imageUrl: string | null;
  isAvailable?: boolean;
  modifierGroups: ModifierGroup[];
}

interface MenuPageProps {
  catalogName: string;
  catalogDescription: string | null;
  items: MenuItemData[];
  categories: string[];
}

export function MenuPage({
  catalogName: _catalogName,
  catalogDescription,
  items,
  categories,
}: MenuPageProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const searchFiltered =
    query.trim() === ""
      ? items
      : items.filter((item) =>
          item.name.toLowerCase().includes(query.toLowerCase()),
        );

  const filtered =
    selectedCategory === null
      ? searchFiltered
      : searchFiltered.filter((item) => item.category === selectedCategory);

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

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {categories.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedCategory === null
                ? "bg-emerald-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <p className="text-sm">
            {query.trim() !== ""
              ? `No items match "${query}"`
              : "No items in this category."}
          </p>
        </div>
      ) : selectedCategory !== null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ category: _category, ...itemProps }) => (
            <ItemCard key={itemProps.itemId} {...itemProps} />
          ))}
        </div>
      ) : (
        <CategoryGroupedItems items={filtered} categories={categories} />
      )}
    </div>
  );
}

interface CategoryGroupedItemsProps {
  items: MenuItemData[];
  categories: string[];
}

function CategoryGroupedItems({ items, categories }: CategoryGroupedItemsProps) {
  const uncategorized = items.filter((item) => item.category === null);
  const hasGroups = categories.length > 0;

  if (!hasGroups) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ category: _category, ...itemProps }) => (
          <ItemCard key={itemProps.itemId} {...itemProps} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {categories.map((cat) => {
        const catItems = items.filter((item) => item.category === cat);
        if (catItems.length === 0) return null;
        return (
          <section key={cat}>
            <h2 className="mb-3 text-lg font-semibold text-slate-700">{cat}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {catItems.map(({ category: _category, ...itemProps }) => (
                <ItemCard key={itemProps.itemId} {...itemProps} />
              ))}
            </div>
          </section>
        );
      })}
      {uncategorized.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-700">Other</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {uncategorized.map(({ category: _category, ...itemProps }) => (
              <ItemCard key={itemProps.itemId} {...itemProps} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
