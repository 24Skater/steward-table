"use client";

import Link from "next/link";
import { useState } from "react";
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

export function CatalogItemsManager({ catalog, churchId }: CatalogItemsManagerProps) {
  const router = useRouter();
  const [removeTarget, setRemoveTarget] = useState<CatalogItem | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"OPEN" | "CLOSED" | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const effectivePrice = (ci: CatalogItem) => ci.priceOverride ?? ci.item.defaultPrice;

  const missingEsCount = catalog.items.filter((ci) => {
    const t = ci.item.translations as ItemTranslations | null;
    return !t?.es?.name?.trim();
  }).length;

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
      router.refresh();
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
                  <Badge
                    variant={
                      ci.isAvailable && ci.item.status === "ACTIVE"
                        ? "default"
                        : "secondary"
                    }
                    className="text-xs shrink-0"
                  >
                    {ci.isAvailable && ci.item.status === "ACTIVE"
                      ? "Available"
                      : "Unavailable"}
                  </Badge>
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
                <span className="text-sm font-medium text-slate-700 tabular-nums">
                  ${(effectivePrice(ci) / 100).toFixed(2)}
                  {ci.priceOverride !== null && (
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      override
                    </span>
                  )}
                </span>
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
