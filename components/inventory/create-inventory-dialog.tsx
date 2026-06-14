"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import type { InventoryRow } from "./inventory-table";

interface CreateInventoryDialogProps {
  open: boolean;
  churchId: string;
  onClose: () => void;
  onCreated: (item: InventoryRow) => void;
}

interface FormState {
  name: string;
  quantity: string;
  lowStockThreshold: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  quantity: "0",
  lowStockThreshold: "",
};

export function CreateInventoryDialog({
  open,
  churchId,
  onClose,
  onCreated,
}: CreateInventoryDialogProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setForm(INITIAL_FORM);
    setError(null);
    onClose();
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    if (!name) {
      setError("Item name is required.");
      return;
    }

    const quantity = Number.parseInt(form.quantity, 10);
    if (Number.isNaN(quantity) || quantity < 0) {
      setError("Quantity must be a non-negative number.");
      return;
    }

    const lowStockThresholdRaw = form.lowStockThreshold.trim();
    const lowStockThreshold =
      lowStockThresholdRaw === "" ? null : Number.parseInt(lowStockThresholdRaw, 10);

    if (lowStockThreshold !== null && Number.isNaN(lowStockThreshold)) {
      setError("Low stock threshold must be a number.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          churchId,
          name,
          quantity,
          lowStockThreshold,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to create item.");
        return;
      }

      const created = (await res.json()) as InventoryRow;
      onCreated(created);
      handleClose();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Inventory Item</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Item Name</Label>
            <Input
              id="inv-name"
              placeholder="e.g. Rice, Chicken Breast, Plates"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-quantity">Initial Quantity</Label>
            <Input
              id="inv-quantity"
              type="number"
              min={0}
              placeholder="0"
              value={form.quantity}
              onChange={(e) => updateField("quantity", e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-threshold">
              Low Stock Threshold <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="inv-threshold"
              type="number"
              min={0}
              placeholder="e.g. 10"
              value={form.lowStockThreshold}
              onChange={(e) => updateField("lowStockThreshold", e.target.value)}
              disabled={submitting}
            />
            <p className="text-xs text-slate-400">
              Items at or below this quantity will be flagged as low stock.
            </p>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
