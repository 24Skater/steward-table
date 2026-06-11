"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface CreateItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogId: string;
  churchId: string;
  onSuccess: () => void;
}

interface FormState {
  name: string;
  description: string;
  basePrice: string;
  isAvailable: boolean;
}

const INITIAL_FORM: FormState = {
  name: "",
  description: "",
  basePrice: "",
  isAvailable: true,
};

export function CreateItemDialog({
  open,
  onOpenChange,
  catalogId,
  churchId,
  onSuccess,
}: CreateItemDialogProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setForm(INITIAL_FORM);
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceFloat = parseFloat(form.basePrice);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (isNaN(priceFloat) || priceFloat < 0) {
      setError("Enter a valid price (e.g. 12.99).");
      return;
    }

    setIsSubmitting(true);
    try {
      // Step 1: create the item
      const itemRes = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          basePrice: priceFloat,
          isAvailable: form.isAvailable,
          churchId,
        }),
      });

      if (!itemRes.ok) {
        const body = await itemRes.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to create item");
      }

      const item = (await itemRes.json()) as { id: string };

      // Step 2: add to catalog
      const catalogRes = await fetch(`/api/catalogs/${catalogId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });

      if (!catalogRes.ok) {
        const body = await catalogRes.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Item created but could not be added to catalog",
        );
      }

      handleClose(false);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create new item</DialogTitle>
          <DialogDescription>
            Add a new item to your church&apos;s library and include it in this catalog.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="item-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="item-name"
              placeholder="e.g. Pupusas de queso"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-description">Description</Label>
            <Textarea
              id="item-description"
              placeholder="Optional description visible to customers"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-price">
              Base price (USD) <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">
                $
              </span>
              <Input
                id="item-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="pl-7"
                value={form.basePrice}
                onChange={(e) => setForm((prev) => ({ ...prev, basePrice: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="item-available" className="text-sm font-medium">
                Available
              </Label>
              <p className="text-xs text-slate-500">
                Show this item as orderable in the catalog.
              </p>
            </div>
            <Switch
              id="item-available"
              checked={form.isAvailable}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, isAvailable: checked }))
              }
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create & add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
