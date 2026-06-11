"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InventoryRow } from "./inventory-table";

interface EditInventoryDialogProps {
  item: InventoryRow | null;
  onClose: () => void;
  onUpdated: (item: InventoryRow) => void;
}

export function EditInventoryDialog({
  item,
  onClose,
  onUpdated,
}: EditInventoryDialogProps) {
  const [lowStockThreshold, setLowStockThreshold] = useState(
    item?.lowStockThreshold?.toString() ?? "",
  );
  const [trackingEnabled, setTrackingEnabled] = useState(
    item?.trackingEnabled ?? true,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setError(null);

    const thresholdRaw = lowStockThreshold.trim();
    const parsedThreshold =
      thresholdRaw === "" ? null : parseInt(thresholdRaw, 10);
    if (parsedThreshold !== null && isNaN(parsedThreshold)) {
      setError("Low stock threshold must be a whole number.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/inventory/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lowStockThreshold: parsedThreshold,
          trackingEnabled,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Failed to update item.");
        return;
      }

      const updated = (await res.json()) as InventoryRow;
      onUpdated(updated);
      handleClose();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Inventory Item</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-500 text-sm">Item</Label>
            <p className="text-sm font-medium text-slate-800">
              {item?.itemName}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-threshold">
              Low Stock Threshold{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="edit-threshold"
              type="number"
              min={0}
              placeholder="e.g. 10"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              disabled={submitting}
            />
            <p className="text-xs text-slate-400">
              Items at or below this quantity are flagged as low stock.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={trackingEnabled}
              onClick={() => setTrackingEnabled((v) => !v)}
              disabled={submitting}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:opacity-50 ${
                trackingEnabled ? "bg-slate-800" : "bg-slate-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  trackingEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <Label
              htmlFor="edit-tracking"
              className="cursor-pointer select-none"
              onClick={() => !submitting && setTrackingEnabled((v) => !v)}
            >
              Track inventory for this item
            </Label>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
