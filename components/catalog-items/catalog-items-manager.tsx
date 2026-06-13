"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreateItemDialog } from "./create-item-dialog";

interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  options: ModifierOption[];
}

interface ItemModifierGroup {
  id: string;
  group: ModifierGroup;
}

interface ItemTranslations {
  es?: { name?: string; description?: string };
}

interface Item {
  id: string;
  name: string;
  description: string | null;
  translations?: unknown;
  defaultPrice: number;
  status: string;
  modifierGroups: ItemModifierGroup[];
}

interface CatalogItem {
  id: string;
  itemId: string;
  isAvailable: boolean;
  priceOverride: number | null;
  maxQuantityPerOrder: number | null;
  item: Item;
}

interface Catalog {
  id: string;
  name: string;
  status: string;
  items: CatalogItem[];
}

interface CatalogItemsManagerProps {
  catalog: Catalog;
  churchId: string;
}

// ── Inline editable price field ──────────────────────────────────────────────

interface InlinePriceProps {
  catalogId: string;
  itemId: string;
  priceOverride: number | null;
  defaultPrice: number;
  onSaved: (next: number | null) => void;
}

function InlinePrice({ catalogId, itemId, priceOverride, defaultPrice, onSaved }: InlinePriceProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    priceOverride !== null ? (priceOverride / 100).toFixed(2) : "",
  );
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const displayPrice = priceOverride ?? defaultPrice;

  async function commit() {
    const trimmed = value.trim();
    let nextOverride: number | null;

    if (trimmed === "" || trimmed === "0") {
      nextOverride = null;
    } else {
      const parsed = parseFloat(trimmed);
      if (isNaN(parsed) || parsed < 0) {
        setValue(priceOverride !== null ? (priceOverride / 100).toFixed(2) : "");
        setEditing(false);
        return;
      }
      nextOverride = Math.round(parsed * 100);
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/catalogs/${catalogId}/items?itemId=${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priceOverride: nextOverride }),
        },
      );
      if (res.ok) onSaved(nextOverride);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        step="0.01"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") {
            setValue(priceOverride !== null ? (priceOverride / 100).toFixed(2) : "");
            setEditing(false);
          }
        }}
        className="w-20 text-sm font-medium tabular-nums border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(priceOverride !== null ? (priceOverride / 100).toFixed(2) : (defaultPrice / 100).toFixed(2));
        setEditing(true);
      }}
      className="text-sm font-medium text-slate-700 tabular-nums hover:underline underline-offset-2 focus:outline-none"
      title="Click to edit price override"
    >
      ${(displayPrice / 100).toFixed(2)}
      {priceOverride !== null && (
        <span className="ml-1 text-xs font-normal text-slate-400">override</span>
      )}
    </button>
  );
}

// ── Inline max quantity field ─────────────────────────────────────────────────

interface InlineMaxQtyProps {
  catalogId: string;
  itemId: string;
  maxQuantityPerOrder: number | null;
  onSaved: (next: number | null) => void;
}

function InlineMaxQty({ catalogId, itemId, maxQuantityPerOrder, onSaved }: InlineMaxQtyProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(maxQuantityPerOrder?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function commit() {
    const trimmed = value.trim();
    let next: number | null;

    if (trimmed === "") {
      next = null;
    } else {
      const parsed = parseInt(trimmed, 10);
      if (isNaN(parsed) || parsed < 1) {
        setValue(maxQuantityPerOrder?.toString() ?? "");
        setEditing(false);
        return;
      }
      next = parsed;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/catalogs/${catalogId}/items?itemId=${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxQuantityPerOrder: next }),
        },
      );
      if (res.ok) onSaved(next);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="1"
        step="1"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") {
            setValue(maxQuantityPerOrder?.toString() ?? "");
            setEditing(false);
          }
        }}
        className="w-14 text-xs border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(maxQuantityPerOrder?.toString() ?? "");
        setEditing(true);
      }}
      className="text-xs text-slate-500 hover:underline underline-offset-2 focus:outline-none"
      title="Click to set max per order"
    >
      {maxQuantityPerOrder !== null
        ? `max ${maxQuantityPerOrder}`
        : <span className="text-slate-300">no max</span>}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CatalogItemsManager({ catalog: initialCatalog, churchId }: CatalogItemsManagerProps) {
  const router = useRouter();
  const [catalog, setCatalog] = useState(initialCatalog);
  const [removeTarget, setRemoveTarget] = useState<CatalogItem | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"OPEN" | "CLOSED" | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const missingEsCount = catalog.items.filter((ci) => {
    const t = ci.item.translations as ItemTranslations | null;
    return !t?.es?.name?.trim();
  }).length;

  function patchItem(itemId: string, patch: Partial<CatalogItem>) {
    setCatalog((prev) => ({
      ...prev,
      items: prev.items.map((ci) =>
        ci.itemId === itemId ? { ...ci, ...patch } : ci,
      ),
    }));
  }

  async function handleToggleAvailability(ci: CatalogItem) {
    const next = !ci.isAvailable;
    patchItem(ci.itemId, { isAvailable: next });
    setTogglingId(ci.itemId);
    try {
      const res = await fetch(
        `/api/catalogs/${catalog.id}/items?itemId=${ci.itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isAvailable: next }),
        },
      );
      if (!res.ok) patchItem(ci.itemId, { isAvailable: ci.isAvailable });
    } catch {
      patchItem(ci.itemId, { isAvailable: ci.isAvailable });
    } finally {
      setTogglingId(null);
    }
  }

  function openPublishDialog() {
    setPendingStatus("OPEN");
    setStatusDialogOpen(true);
  }

  function openCloseDialog() {
    setPendingStatus("CLOSED");
    setStatusDialogOpen(true);
  }

  async function handleStatusConfirm() {
    if (!pendingStatus) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/catalogs/${catalog.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: pendingStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to update status");
      }
      setStatusDialogOpen(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setIsRemoving(true);
    try {
      const res = await fetch(
        `/api/catalogs/${catalog.id}/items?itemId=${removeTarget.itemId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to remove item");
      }
      setCatalog((prev) => ({
        ...prev,
        items: prev.items.filter((ci) => ci.itemId !== removeTarget.itemId),
      }));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to remove item");
    } finally {
      setIsRemoving(false);
      setRemoveTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href="/catalog"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to catalogs
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{catalog.name}</h1>
            <Badge
              variant={catalog.status === "OPEN" ? "default" : "secondary"}
              className="capitalize text-xs"
            >
              {catalog.status.toLowerCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-slate-500">
              {catalog.items.length}{" "}
              {catalog.items.length === 1 ? "item" : "items"}
            </p>
            {missingEsCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {missingEsCount} {missingEsCount === 1 ? "item" : "items"} missing Spanish
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {catalog.status === "DRAFT" || catalog.status === "CLOSED" ? (
            <Button
              onClick={openPublishDialog}
              disabled={catalog.items.length === 0}
              title={catalog.items.length === 0 ? "Add at least one item before publishing" : undefined}
            >
              Publish
            </Button>
          ) : catalog.status === "OPEN" ? (
            <Button variant="outline" onClick={openCloseDialog}>
              Close catalog
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Items list */}
      {catalog.items.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500 text-sm">No items in this catalog yet.</p>
          <p className="text-slate-400 text-xs mt-1">
            Add items to start building your catalog.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
          {catalog.items.map((ci) => (
            <div
              key={ci.id}
              className="flex items-center justify-between px-4 py-3 gap-4"
            >
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 text-sm truncate">
                    {ci.item.name}
                  </span>
                  {!(ci.item.translations as ItemTranslations | null)?.es?.name?.trim() && (
                    <span title="Missing Spanish translation" className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  )}
                </div>
                {ci.item.description && (
                  <p className="text-xs text-slate-500 truncate">
                    {ci.item.description}
                  </p>
                )}
                {ci.item.modifierGroups.length > 0 && (
                  <p className="text-xs text-slate-400">
                    Modifiers:{" "}
                    {ci.item.modifierGroups.map((mg) => mg.group.name).join(", ")}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* Inline max qty */}
                <InlineMaxQty
                  catalogId={catalog.id}
                  itemId={ci.itemId}
                  maxQuantityPerOrder={ci.maxQuantityPerOrder}
                  onSaved={(next) => patchItem(ci.itemId, { maxQuantityPerOrder: next })}
                />

                {/* Inline price override */}
                <InlinePrice
                  catalogId={catalog.id}
                  itemId={ci.itemId}
                  priceOverride={ci.priceOverride}
                  defaultPrice={ci.item.defaultPrice}
                  onSaved={(next) => patchItem(ci.itemId, { priceOverride: next })}
                />

                {/* Availability toggle */}
                <button
                  type="button"
                  disabled={togglingId === ci.itemId}
                  onClick={() => handleToggleAvailability(ci)}
                  title={ci.isAvailable ? "Mark unavailable" : "Mark available"}
                  className="flex items-center focus:outline-none disabled:opacity-50"
                  aria-label={ci.isAvailable ? "Available — click to mark unavailable" : "Unavailable — click to mark available"}
                >
                  <Badge
                    variant={ci.isAvailable && ci.item.status === "ACTIVE" ? "default" : "secondary"}
                    className="text-xs cursor-pointer hover:opacity-75 transition-opacity"
                  >
                    {ci.isAvailable && ci.item.status === "ACTIVE" ? "Available" : "Unavailable"}
                  </Badge>
                </button>

                <Link
                  href={`/catalog/${catalog.id}/items/${ci.item.id}`}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title={`Manage modifiers for ${ci.item.name}`}
                >
                  <Settings2 className="h-4 w-4" />
                  <span className="sr-only">Manage modifiers for {ci.item.name}</span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-400 hover:text-red-500"
                  onClick={() => setRemoveTarget(ci)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Remove {ci.item.name}</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create item dialog */}
      <CreateItemDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        catalogId={catalog.id}
        churchId={churchId}
        onSuccess={() => router.refresh()}
      />

      {/* Publish / Close confirmation dialog */}
      <Dialog
        open={statusDialogOpen}
        onOpenChange={(open) => {
          if (!open) { setStatusDialogOpen(false); setPendingStatus(null); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingStatus === "OPEN" ? `Publish "${catalog.name}"?` : `Close "${catalog.name}"?`}
            </DialogTitle>
            <DialogDescription>
              {pendingStatus === "OPEN" ? (
                <>
                  {missingEsCount > 0 && (
                    <span className="block mb-2 text-amber-700 font-medium">
                      {missingEsCount} {missingEsCount === 1 ? "item is" : "items are"} missing Spanish translations. Customers viewing in Spanish will see the English name as a fallback.
                    </span>
                  )}
                  Customers will be able to place orders once the catalog is open.
                </>
              ) : (
                "Orders already placed will continue normally. New orders won't be accepted."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setStatusDialogOpen(false); setPendingStatus(null); }}
              disabled={isUpdatingStatus}
            >
              Cancel
            </Button>
            <Button onClick={handleStatusConfirm} disabled={isUpdatingStatus}>
              {isUpdatingStatus
                ? "Saving…"
                : pendingStatus === "OPEN"
                ? "Publish"
                : "Close catalog"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation dialog */}
      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove item from catalog?</DialogTitle>
            <DialogDescription>
              <strong>{removeTarget?.item.name}</strong> will be removed from this
              catalog. The item itself will not be deleted and can be re-added later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={isRemoving}
            >
              {isRemoving ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
