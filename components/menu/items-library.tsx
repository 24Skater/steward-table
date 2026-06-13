"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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

// ── Set-price dialog ───────────────────────────────────────────────────────

interface SetPriceDialogProps {
  count: number;
  onConfirm: (mode: "fixed" | "percent", value: number) => Promise<void>;
  onClose: () => void;
}

function SetPriceDialog({ count, onConfirm, onClose }: SetPriceDialogProps) {
  const [mode, setMode] = useState<"fixed" | "percent">("fixed");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(value);
    if (isNaN(num)) { setError("Enter a valid number"); return; }
    if (mode === "fixed" && num < 0) { setError("Price must be ≥ 0"); return; }
    setBusy(true);
    try {
      await onConfirm(mode, num);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set price for {count} item{count !== 1 ? "s" : ""}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="flex gap-2">
            {(["fixed", "percent"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  mode === m ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600"
                }`}
              >
                {m === "fixed" ? "Fixed price" : "% adjustment"}
              </button>
            ))}
          </div>
          <div>
            <label className="text-sm text-slate-600 mb-1 block">
              {mode === "fixed" ? "New price (USD)" : "Adjustment (e.g. 10 for +10%, -5 for -5%)"}
            </label>
            <Input
              type="number"
              step={mode === "fixed" ? "0.01" : "0.1"}
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(null); }}
              placeholder={mode === "fixed" ? "3.00" : "10"}
              autoFocus
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Apply"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Set-tax-category dialog ────────────────────────────────────────────────

interface SetTaxCategoryDialogProps {
  count: number;
  onConfirm: (taxCategory: string | null) => Promise<void>;
  onClose: () => void;
}

function SetTaxCategoryDialog({ count, onConfirm, onClose }: SetTaxCategoryDialogProps) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onConfirm(value.trim() || null);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set tax category for {count} item{count !== 1 ? "s" : ""}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label className="text-sm text-slate-600 mb-1 block">Tax category (leave blank to clear)</label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. FOOD, TAX_EXEMPT"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Apply"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Bulk action bar ────────────────────────────────────────────────────────

interface BulkActionBarProps {
  selected: Set<string>;
  items: LibraryItem[];
  onClearSelection: () => void;
  onBulkUpdate: (updatedIds: string[], patch: Partial<LibraryItem>) => void;
  onBulkRemove: (removedIds: string[]) => void;
}

function BulkActionBar({ selected, items, onClearSelection, onBulkUpdate, onBulkRemove }: BulkActionBarProps) {
  const [dialog, setDialog] = useState<"price" | "tax" | null>(null);
  const [busy, setBusy] = useState(false);
  const count = selected.size;
  const selectedIds = Array.from(selected);

  async function callBulk(body: object) {
    const res = await fetch("/api/menu/items/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, itemIds: selectedIds }),
    });
    if (!res.ok) throw new Error("Bulk operation failed");
  }

  async function handleSetStatus(value: "ACTIVE" | "INACTIVE") {
    setBusy(true);
    try {
      await callBulk({ action: "set_status", value });
      onBulkUpdate(selectedIds, { status: value });
      onClearSelection();
    } catch { /* show nothing — user can retry */ }
    finally { setBusy(false); }
  }

  async function handleArchive() {
    if (!confirm(`Archive ${count} item${count !== 1 ? "s" : ""}? They will be hidden from all views.`)) return;
    setBusy(true);
    try {
      await callBulk({ action: "archive" });
      onBulkRemove(selectedIds);
      onClearSelection();
    } catch { /* */ }
    finally { setBusy(false); }
  }

  async function handleSetPrice(mode: "fixed" | "percent", value: number) {
    await callBulk({ action: "set_price", mode, value });
    if (mode === "fixed") {
      const cents = Math.round(value * 100);
      onBulkUpdate(selectedIds, { defaultPrice: cents });
    }
    onClearSelection();
  }

  async function handleSetTax(taxCategory: string | null) {
    await callBulk({ action: "set_tax_category", taxCategory });
    onBulkUpdate(selectedIds, { taxCategory });
    onClearSelection();
  }

  const canDelete = selectedIds.every((id) => {
    const item = items.find((i) => i.id === id);
    return item ? item.catalogItems.length === 0 : false;
  });

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 shadow-2xl shadow-slate-900/30 border border-slate-700">
        <span className="text-sm text-slate-300 font-medium mr-2 shrink-0">
          {count} selected
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => handleSetStatus("ACTIVE")}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-40"
        >
          Activate
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handleSetStatus("INACTIVE")}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-40"
        >
          Deactivate
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setDialog("price")}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-40"
        >
          Set price
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setDialog("tax")}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-40"
        >
          Set tax
        </button>
        {canDelete && (
          <button
            type="button"
            disabled={busy}
            onClick={handleArchive}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-900/60 text-red-300 hover:bg-red-900 transition-colors disabled:opacity-40"
          >
            Archive
          </button>
        )}
        <div className="w-px h-4 bg-slate-700 mx-1" />
        <button
          type="button"
          onClick={onClearSelection}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Clear selection"
        >
          <X size={14} />
        </button>
      </div>

      {dialog === "price" && (
        <SetPriceDialog
          count={count}
          onConfirm={handleSetPrice}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "tax" && (
        <SetTaxCategoryDialog
          count={count}
          onConfirm={handleSetTax}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: LibraryItem;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onToggleStatus: (itemId: string, next: "ACTIVE" | "INACTIVE") => Promise<void>;
  inFlight: boolean;
}

function ItemRow({ item, selected, onSelect, onToggleStatus, inFlight }: ItemRowProps) {
  const missingEs = !hasEsTranslation(item);
  const catalogs = item.catalogItems.map((ci) => ci.catalog);
  const nextStatus: "ACTIVE" | "INACTIVE" = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  return (
    <tr
      className={`border-b border-slate-100 transition-colors ${selected ? "bg-blue-50/60" : "hover:bg-slate-50/50"}`}
    >
      {/* Checkbox */}
      <td className="py-3 pl-4 pr-2 w-8">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(item.id, e.target.checked)}
          className="rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer"
          aria-label={`Select ${item.name}`}
        />
      </td>

      {/* Photo */}
      <td className="py-3 pr-3">
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
  const [missingEsOnly, setMissingEsOnly] = useState(false);
  const [inFlight, setInFlight] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const missingEsCount = items.filter((i) => !hasEsTranslation(i)).length;

  const filtered = items.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    if (missingEsOnly && hasEsTranslation(item)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const enMatch = item.name.toLowerCase().includes(q);
      const esMatch = item.translations?.es?.name?.toLowerCase().includes(q) ?? false;
      if (!enMatch && !esMatch) return false;
    }
    return true;
  });

  const filteredIds = new Set(filtered.map((i) => i.id));
  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));

  function handleSelectAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of filteredIds) {
        if (checked) next.add(id); else next.delete(id);
      }
      return next;
    });
  }

  function handleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

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

  function handleBulkUpdate(updatedIds: string[], patch: Partial<LibraryItem>) {
    setItems((prev) =>
      prev.map((it) => (updatedIds.includes(it.id) ? { ...it, ...patch } : it)),
    );
  }

  function handleBulkRemove(removedIds: string[]) {
    setItems((prev) => prev.filter((it) => !removedIds.includes(it.id)));
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
      {missingEsCount > 0 && !missingEsOnly && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{missingEsCount} item{missingEsCount !== 1 ? "s" : ""}</strong> missing Spanish translations.{" "}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-amber-900"
              onClick={() => setMissingEsOnly(true)}
            >
              Show only
            </button>
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items (EN or ES)…"
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
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
          {missingEsCount > 0 && (
            <button
              type="button"
              onClick={() => setMissingEsOnly((v) => !v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                missingEsOnly
                  ? "bg-amber-500 text-white"
                  : "border border-amber-200 text-amber-600 hover:border-amber-300"
              }`}
            >
              Missing ES
            </button>
          )}
        </div>
        {missingEsOnly && (
          <button
            type="button"
            onClick={() => setMissingEsOnly(false)}
            className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
          >
            Clear
          </button>
        )}
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
                onClick={() => { setSearch(""); setStatusFilter("ALL"); setMissingEsOnly(false); }}
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
                <th className="py-2.5 pl-4 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer"
                    aria-label="Select all"
                  />
                </th>
                <th className="py-2.5 pr-3" />
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
                  selected={selected.has(item.id)}
                  onSelect={handleSelect}
                  onToggleStatus={handleToggleStatus}
                  inFlight={inFlight === item.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <BulkActionBar
          selected={selected}
          items={items}
          onClearSelection={() => setSelected(new Set())}
          onBulkUpdate={handleBulkUpdate}
          onBulkRemove={handleBulkRemove}
        />
      )}
    </div>
  );
}
