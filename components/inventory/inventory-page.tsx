"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InventoryTable } from "./inventory-table";
import { CreateInventoryDialog } from "./create-inventory-dialog";
import type { InventoryRow } from "./inventory-table";

interface InventoryPageProps {
  churchId: string;
  initialItems: InventoryRow[];
}

export function InventoryPage({ churchId, initialItems }: InventoryPageProps) {
  const [items, setItems] = useState<InventoryRow[]>(initialItems);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    setCreateOpen(false);
    // Edit opens the create dialog pre-populated — handled inline via state if needed.
    // For now, this is a placeholder for a future edit dialog.
    void item;
  }

  function handleCreated(newItem: InventoryRow): void {
    setItems((prev) => [newItem, ...prev]);
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

        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Add Item
        </Button>
      </div>

      {/* Error banner */}
      {deleteError && (
        <div className="mx-6 mt-3 rounded bg-red-50 px-4 py-2 text-sm text-red-700 border border-red-200 flex items-center justify-between">
          <span>{deleteError}</span>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="ml-3 text-red-500 hover:text-red-700 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="px-6 py-4">
          <InventoryTable
            items={items}
            onQuantityChange={handleQuantityChange}
            onEdit={handleEdit}
            onDelete={(item) => void handleDelete(item)}
          />
        </div>
      </div>

      <CreateInventoryDialog
        open={createOpen}
        churchId={churchId}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
