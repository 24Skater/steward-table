"use client";

import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InventoryTable } from "./inventory-table";
import { CreateInventoryDialog } from "./create-inventory-dialog";
import { EditInventoryDialog } from "./edit-inventory-dialog";
import type { InventoryRow } from "./inventory-table";

interface InventoryPageProps {
  churchId: string;
  initialItems: InventoryRow[];
}

export function InventoryPage({ churchId, initialItems }: InventoryPageProps) {
  const [items, setItems] = useState<InventoryRow[]>(initialItems);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [stocktakeMode, setStocktakeMode] = useState(false);
  const [stocktakeCounts, setStocktakeCounts] = useState<Record<string, number>>({});
  const [stocktakeSaving, setStocktakeSaving] = useState(false);
  const [stocktakeError, setStocktakeError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  async function handleQuantityChange(
    inventoryItemId: string,
    newQty: number,
  ): Promise<void> {
    const previous = items;
    setItems((prev) =>
      prev.map((item) =>
        item.id === inventoryItemId
          ? { ...item, quantityOnHand: newQty, updatedAt: new Date().toISOString() }
          : item,
      ),
    );

    try {
      const res = await fetch(`/api/inventory/${inventoryItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantityOnHand: newQty }),
      });

      if (!res.ok) {
        setItems(previous);
      }
    } catch {
      setItems(previous);
    }
  }

  async function handleDelete(item: InventoryRow): Promise<void> {
    setDeleteError(null);
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    try {
      const res = await fetch(`/api/inventory/${item.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setItems(previous);
        setDeleteError(`Failed to delete "${item.itemName}".`);
      }
    } catch {
      setItems(previous);
      setDeleteError(`Failed to delete "${item.itemName}".`);
    }
  }

  function handleEdit(item: InventoryRow): void {
    setEditingItem(item);
  }

  function handleUpdated(updated: InventoryRow): void {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  function handleCreated(newItem: InventoryRow): void {
    setItems((prev) => [newItem, ...prev]);
  }

  function enterStocktake() {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.id] = item.quantityOnHand;
    }
    setStocktakeCounts(counts);
    setStocktakeMode(true);
    setStocktakeError(null);
    // Focus first input on next tick
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }

  async function saveStocktake() {
    setStocktakeSaving(true);
    setStocktakeError(null);

    const updates = Object.entries(stocktakeCounts);
    const results = await Promise.allSettled(
      updates.map(async ([id, qty]) => {
        const res = await fetch(`/api/inventory/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantityOnHand: qty }),
        });
        if (!res.ok) throw new Error(`Failed to update ${id}`);
        return { id, qty };
      }),
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      setStocktakeError(`${failed} item(s) failed to save. Please retry.`);
      setStocktakeSaving(false);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        stocktakeCounts[item.id] !== undefined
          ? { ...item, quantityOnHand: stocktakeCounts[item.id] ?? item.quantityOnHand }
          : item,
      ),
    );
    setStocktakeMode(false);
    setStocktakeSaving(false);
  }

  const lowStockCount = items.filter(
    (item) =>
      item.lowStockThreshold !== null &&
      item.quantityOnHand <= item.lowStockThreshold &&
      item.quantityOnHand > 0,
  ).length;

  const outOfStockCount = items.filter(
    (item) => item.quantityOnHand <= 0,
  ).length;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-6 pt-4 pb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-slate-700">All Items</h3>
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-600 border-slate-200 text-xs tabular-nums"
          >
            {items.length}
          </Badge>
          {lowStockCount > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs tabular-nums">
              {lowStockCount} low
            </Badge>
          )}
          {outOfStockCount > 0 && (
            <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs tabular-nums">
              {outOfStockCount} out
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {stocktakeMode ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStocktakeMode(false)}
                disabled={stocktakeSaving}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={() => void saveStocktake()} disabled={stocktakeSaving}>
                {stocktakeSaving ? "Saving…" : "Save counts"}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={enterStocktake}>
                Stocktake
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Add Item
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stocktake banner */}
      {stocktakeMode && (
        <div className="mx-6 mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          Stocktake mode — update quantities for all items, then tap <strong>Save counts</strong>.
        </div>
      )}

      {/* Error banner */}
      {(deleteError ?? stocktakeError) && (
        <div className="mx-6 mt-3 rounded bg-red-50 px-4 py-2 text-sm text-red-700 border border-red-200 flex items-center justify-between">
          <span>{deleteError ?? stocktakeError}</span>
          <button
            type="button"
            onClick={() => { setDeleteError(null); setStocktakeError(null); }}
            className="ml-3 text-red-500 hover:text-red-700 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="px-6 py-4">
          {stocktakeMode ? (
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Item</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-32">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-700 font-medium">{item.itemName}</td>
                      <td className="px-4 py-2.5">
                        <input
                          ref={idx === 0 ? firstInputRef : undefined}
                          type="number"
                          min={0}
                          step={1}
                          value={stocktakeCounts[item.id] ?? item.quantityOnHand}
                          onChange={(e) =>
                            setStocktakeCounts((prev) => ({
                              ...prev,
                              [item.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                            }))
                          }
                          className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <InventoryTable
              items={items}
              onQuantityChange={handleQuantityChange}
              onEdit={handleEdit}
              onDelete={(item) => void handleDelete(item)}
            />
          )}
        </div>
      </div>

      <CreateInventoryDialog
        open={createOpen}
        churchId={churchId}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      <EditInventoryDialog
        key={editingItem?.id}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onUpdated={handleUpdated}
      />
    </div>
  );
}
