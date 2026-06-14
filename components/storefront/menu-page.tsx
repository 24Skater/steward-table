"use client";

import { ItemCard } from "@/components/storefront/item-card";
import { useStorefrontStrings } from "@/components/storefront/storefront-locale-provider";
import { Search } from "lucide-react";
import { useState } from "react";

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
  maxQuantityPerOrder?: number | null;
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
  const s = useStorefrontStrings();

  const searchFiltered =
    query.trim() === ""
      ? items
      : items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));

  const filtered =
    selectedCategory === null
      ? searchFiltered
      : searchFiltered.filter((item) => item.category === selectedCategory);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <p className="text-lg font-medium">{s.noItemsAvailable}</p>
        <p className="mt-1 text-sm">{s.checkBackSoon}</p>
      </div>
    );
  }

  return (
    <div>
      {catalogDescription && <p className="mb-4 text-slate-500">{catalogDescription}</p>}

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={s.searchPlaceholder}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      {categories.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedCategory === null
                ? "text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            style={
              selectedCategory === null
                ? { backgroundColor: "var(--color-accent, #10b981)" }
                : undefined
            }
          >
            {s.allCategories}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                selectedCategory === cat
                  ? "text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              style={
                selectedCategory === cat
                  ? { backgroundColor: "var(--color-accent, #10b981)" }
                  : undefined
              }
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <p className="text-sm">
            {query.trim() !== "" ? `${s.noItemsMatchQuery} "${query}"` : s.noItemsInCategory}
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
