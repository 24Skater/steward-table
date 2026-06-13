"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ── Types ──────────────────────────────────────────────────────────────────

interface CatalogRef {
  id: string;
  name: string;
  status: string;
}

interface ItemTranslations {
  es?: { name?: string; description?: string };
}

interface LibraryItem {
  id: string;
  name: string;
  description: string | null;
  defaultPrice: number;
  imageUrl: string | null;
  status: string;
  taxCategory: string | null;
  translations: ItemTranslations | null;
  _count: { modifierGroups: number };
  catalogItems: Array<{ catalog: CatalogRef }>;
}

interface ItemsLibraryProps {
  items: LibraryItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
}

function hasEsTranslation(item: LibraryItem): boolean {
  return Boolean(item.translations?.es?.name?.trim());
}

// ── Row ────────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: LibraryItem;
  onToggleStatus: (itemId: string, next: "ACTIVE" | "INACTIVE") => Promise<void>;
  inFlight: boolean;
}

function ItemRow({ item, onToggleStatus, inFlight }: ItemRowProps) {
  const missingEs = !hasEsTranslation(item);
  const catalogs = item.catalogItems.map((ci) => ci.catalog);
  const nextStatus: "ACTIVE" | "INACTIVE" = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
      {/* Photo */}
      <td className="py-3 pl-4 pr-3">
        <div className="h-10 w-10 rounded-md overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-lg select-none">🍽</span>
          )}
        </div>
      </td>

      {/* Name */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/menu/items/${item.id}`}
            className="text-sm font-medium text-slate-800 hover:underline underline-offset-2"
          >
            {item.name}
          </Link>
          {missingEs && (
            <span
              className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0"
              title="Missing Spanish translation"
            />
          )}
        </div>
        {item.description && (
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.description}</p>
        )}
      </td>

      {/* Price */}
      <td className="py-3 px-3 text-sm text-slate-700 tabular-nums whitespace-nowrap">
        {formatPrice(item.defaultPrice)}
      </td>

      {/* Tax category */}
      <td className="py-3 px-3 text-xs text-slate-500">
        {item.taxCategory ?? <span className="text-slate-300">—</span>}
      </td>

      {/* Modifier groups */}
      <td className="py-3 px-3 text-sm text-slate-500 text-center">
        {item._count.modifierGroups > 0 ? item._count.modifierGroups : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* Used in */}
      <td className="py-3 px-3 text-xs text-slate-500 max-w-[200px]">
        {catalogs.length === 0 ? (
          <span className="text-slate-300">Not in any catalog</span>
        ) : (
          <span className="line-clamp-2">{catalogs.map((c) => c.name).join(", ")}</span>
        )}
      </td>

      {/* Status */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <Badge
            variant={item.status === "ACTIVE" ? "default" : "outline"}
            className="text-xs"
          >
            {item.status === "ACTIVE" ? "Active" : "Inactive"}
          </Badge>
          <button
            type="button"
            disabled={inFlight}
            onClick={() => onToggleStatus(item.id, nextStatus)}
            className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-40 transition-colors underline underline-offset-2"
          >
            {inFlight ? "…" : item.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </button>
        </div>
      </td>

      {/* Edit link */}
      <td className="py-3 pl-3 pr-4">
        <Link href={`/menu/items/${item.id}`}>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500">
            Edit
          </Button>
        </Link>
      </td>
    </tr>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function ItemsLibrary({ items: initialItems }: ItemsLibraryProps) {
  const [items, setItems] = useState<LibraryItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [inFlight, setInFlight] = useState<string | null>(null);

  const missingEsCount = items.filter((i) => !hasEsTranslation(i)).length;

  const filtered = items.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const enMatch = item.name.toLowerCase().includes(q);
      const esMatch = item.translations?.es?.name?.toLowerCase().includes(q) ?? false;
      if (!enMatch && !esMatch) return false;
    }
    return true;
  });

  async function handleToggleStatus(itemId: string, next: "ACTIVE" | "INACTIVE") {
    setInFlight(itemId);
    try {
      const res = await fetch(`/api/menu/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) return;
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: next } : it)),
      );
    } finally {
      setInFlight(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Menu Items</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            All items in your library. Items can be added to catalogs.
          </p>
        </div>
        <Link href="/menu/items/new">
          <Button className="flex items-center gap-1.5">
            <Plus size={15} />
            New Item
          </Button>
        </Link>
      </div>

      {/* Missing translations banner */}
      {missingEsCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{missingEsCount} item{missingEsCount !== 1 ? "s" : ""}</strong> missing Spanish translations.{" "}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-amber-900"
              onClick={() => setStatusFilter("ALL")}
            >
              View all
            </button>
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items (EN or ES)…"
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {s === "ALL" ? "All" : s === "ACTIVE" ? "Active" : "Inactive"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
          {items.length === 0 ? (
            <>
              <p className="text-slate-500 text-sm">No items yet.</p>
              <p className="text-slate-400 text-xs mt-1">
                Create your first item, or start a catalog from a template.
              </p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <Link href="/menu/items/new">
                  <Button size="sm">+ New Item</Button>
                </Link>
                <Link href="/catalog">
                  <Button variant="outline" size="sm">Use a template</Button>
                </Link>
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-sm">
              No items match your filters.{" "}
              <button
                type="button"
                className="underline underline-offset-2 text-slate-500"
                onClick={() => { setSearch(""); setStatusFilter("ALL"); }}
              >
                Clear filters
              </button>
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="py-2.5 pl-4 pr-3 text-xs font-semibold text-slate-400 uppercase tracking-wide" />
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Name</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Price</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Tax</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">Modifiers</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Used in</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                <th className="py-2.5 pl-3 pr-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggleStatus={handleToggleStatus}
                  inFlight={inFlight === item.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
