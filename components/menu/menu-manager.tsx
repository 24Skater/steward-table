"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ── Types ──────────────────────────────────────────────────────────────────

interface CatalogItemRow {
  id: string;
  sortOrder: number;
  deletedAt: Date | null;
  item: {
    id: string;
    name: string;
    description: string | null;
    defaultPrice: number;
    imageUrl: string | null;
    status: string;
    _count: { modifierGroups: number };
  };
}

interface CatalogRow {
  id: string;
  name: string;
  status: string;
  items: CatalogItemRow[];
}

interface MenuManagerProps {
  catalogs: CatalogRow[];
  churchId: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function catalogStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "OPEN":
      return "default";
    case "DRAFT":
      return "secondary";
    case "CLOSED":
      return "outline";
    case "ARCHIVED":
      return "destructive";
    default:
      return "secondary";
  }
}

function itemStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "INACTIVE":
      return "destructive";
    default:
      return "secondary";
  }
}

function itemStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Available";
    case "INACTIVE":
      return "Unavailable";
    default:
      return status;
  }
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
}

// ── Add Item Dialog ────────────────────────────────────────────────────────

interface AddItemDialogProps {
  catalogId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (catalogId: string, item: CatalogItemRow) => void;
}

function AddItemDialog({ catalogId, open, onOpenChange, onAdded }: AddItemDialogProps) {
  const [itemName, setItemName] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = itemName.trim();
    const priceFloat = parseFloat(priceStr);
    if (!trimmedName || isNaN(priceFloat) || priceFloat < 0) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogId,
          name: trimmedName,
          priceCents: Math.round(priceFloat * 100),
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to add item");
      }

      const data = await res.json() as { catalogItem: CatalogItemRow };
      onAdded(catalogId, data.catalogItem);
      setItemName("");
      setPriceStr("");
      setDescription("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Jerk Chicken Plate"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-price">Price (USD)</Label>
            <Input
              id="item-price"
              type="number"
              min="0"
              step="0.01"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              placeholder="12.00"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-description">Description (optional)</Label>
            <Textarea
              id="item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the item…"
              rows={2}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !itemName.trim() || !priceStr}>
              {saving ? "Adding…" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Item Card ──────────────────────────────────────────────────────────────

interface ItemCardProps {
  catalogItemId: string;
  item: CatalogItemRow["item"];
  onStatusChanged: (catalogItemId: string, newStatus: string) => void;
}

function ItemCard({ catalogItemId: _catalogItemId, item, onStatusChanged }: ItemCardProps) {
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    setToggling(true);
    const nextStatus = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/menu/items/${item.id}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: nextStatus === "ACTIVE" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to update status");
      }
      onStatusChanged(_catalogItemId, nextStatus);
    } catch {
      // Silently fail — status reverts via no-update
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden flex flex-col">
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt={item.name}
          className="h-32 w-full object-cover"
        />
      ) : (
        <div className="h-32 w-full bg-slate-100 flex items-center justify-center">
          <span className="text-3xl select-none">🍽</span>
        </div>
      )}

      <div className="flex flex-col flex-1 p-3 gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-slate-900 leading-snug">{item.name}</p>
          <Badge variant={itemStatusVariant(item.status)} className="text-xs shrink-0">
            {itemStatusLabel(item.status)}
          </Badge>
        </div>

        <p className="text-sm font-semibold text-slate-700">{formatPrice(item.defaultPrice)}</p>

        {item.description && (
          <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>
        )}

        {item._count.modifierGroups > 0 && (
          <p className="text-xs text-slate-400">
            {item._count.modifierGroups} modifier{item._count.modifierGroups !== 1 ? "s" : ""}
          </p>
        )}

        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={handleToggle}
            disabled={toggling}
          >
            {toggling ? "…" : item.status === "ACTIVE" ? "Mark unavailable" : "Mark available"}
          </Button>
          <Link href={`/menu/items/${item.id}` as never}>
            <Button variant="ghost" size="sm" className="px-2">
              <ChevronRight size={14} />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function MenuManager({ catalogs: initialCatalogs }: MenuManagerProps) {
  const [catalogs, setCatalogs] = useState<CatalogRow[]>(initialCatalogs);
  const [dialogCatalogId, setDialogCatalogId] = useState<string | null>(null);

  function handleItemAdded(catalogId: string, newCatalogItem: CatalogItemRow) {
    setCatalogs((prev) =>
      prev.map((cat) => {
        if (cat.id !== catalogId) return cat;
        return { ...cat, items: [...cat.items, newCatalogItem] };
      }),
    );
  }

  function handleStatusChanged(catalogId: string, catalogItemId: string, newStatus: string) {
    setCatalogs((prev) =>
      prev.map((cat) => {
        if (cat.id !== catalogId) return cat;
        return {
          ...cat,
          items: cat.items.map((ci) => {
            if (ci.id !== catalogItemId) return ci;
            return { ...ci, item: { ...ci.item, status: newStatus } };
          }),
        };
      }),
    );
  }

  if (catalogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-slate-500 text-sm">No catalogs found.</p>
        <p className="text-slate-400 text-xs mt-1">
          Create a catalog first to start adding menu items.
        </p>
        <Link href="/catalog" className="mt-4">
          <Button variant="outline" size="sm">
            Go to Catalogs
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Menu</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Manage items across your catalogs. Toggle availability or edit items.
        </p>
      </div>

      {catalogs.map((catalog) => (
        <section key={catalog.id} className="space-y-4">
          {/* Catalog header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-800">{catalog.name}</h2>
              <Badge variant={catalogStatusVariant(catalog.status)} className="text-xs">
                {catalog.status}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogCatalogId(catalog.id)}
              className="flex items-center gap-1.5"
            >
              <Plus size={14} />
              Add item
            </Button>
          </div>

          {/* Items grid */}
          {catalog.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-10 text-center">
              <p className="text-slate-400 text-sm">No items yet.</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-slate-500"
                onClick={() => setDialogCatalogId(catalog.id)}
              >
                <Plus size={14} className="mr-1" />
                Add first item
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {catalog.items.map((ci) => (
                <ItemCard
                  key={ci.id}
                  catalogItemId={ci.id}
                  item={ci.item}
                  onStatusChanged={(catalogItemId, newStatus) =>
                    handleStatusChanged(catalog.id, catalogItemId, newStatus)
                  }
                />
              ))}
            </div>
          )}
        </section>
      ))}

      {/* Add item dialog */}
      {dialogCatalogId && (
        <AddItemDialog
          catalogId={dialogCatalogId}
          open={dialogCatalogId !== null}
          onOpenChange={(open) => {
            if (!open) setDialogCatalogId(null);
          }}
          onAdded={handleItemAdded}
        />
      )}
    </div>
  );
}
