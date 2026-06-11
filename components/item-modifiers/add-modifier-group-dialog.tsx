"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Switch } from "@/components/ui/switch";

interface AddModifierGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
}

export function AddModifierGroupDialog({
  open,
  onOpenChange,
  itemId,
}: AddModifierGroupDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [required, setRequired] = useState(false);
  const [minSelections, setMinSelections] = useState(0);
  const [maxSelections, setMaxSelections] = useState(1);
  const [firstOptionName, setFirstOptionName] = useState("");
  const [firstOptionPrice, setFirstOptionPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setRequired(false);
    setMinSelections(0);
    setMaxSelections(1);
    setFirstOptionName("");
    setFirstOptionPrice("");
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  function handleRequiredChange(checked: boolean) {
    setRequired(checked);
    if (checked && minSelections === 0) {
      setMinSelections(1);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Group name is required.");
      return;
    }
    if (maxSelections < 1) {
      setError("Max selections must be at least 1.");
      return;
    }
    if (minSelections > maxSelections) {
      setError("Min selections cannot exceed max selections.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const groupRes = await fetch(`/api/items/${itemId}/modifier-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), required, minSelections, maxSelections }),
      });

      if (!groupRes.ok) {
        const body = await groupRes.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to create modifier group");
      }

      const group = await groupRes.json() as { id: string };

      if (firstOptionName.trim()) {
        const rawPrice = parseFloat(firstOptionPrice);
        const priceDelta = isNaN(rawPrice) ? 0 : Math.round(rawPrice * 100);

        const optionRes = await fetch(`/api/modifier-groups/${group.id}/options`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: firstOptionName.trim(), priceDelta }),
        });

        if (!optionRes.ok) {
          const body = await optionRes.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? "Failed to create option");
        }
      }

      router.refresh();
      handleOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add modifier group</DialogTitle>
            <DialogDescription>
              Create a new group of options for this item (e.g., "Pupusa Filling").
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                placeholder="e.g. Pupusa Filling"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="required-toggle">Required</Label>
                <p className="text-xs text-slate-500">
                  Customer must make a selection
                </p>
              </div>
              <Switch
                id="required-toggle"
                checked={required}
                onCheckedChange={handleRequiredChange}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="min-selections">Min selections</Label>
                <Input
                  id="min-selections"
                  type="number"
                  min={0}
                  max={maxSelections}
                  value={minSelections}
                  onChange={(e) => setMinSelections(Number(e.target.value))}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-selections">Max selections</Label>
                <Input
                  id="max-selections"
                  type="number"
                  min={1}
                  value={maxSelections}
                  onChange={(e) => setMaxSelections(Number(e.target.value))}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                First option (optional)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="option-name">Option name</Label>
                  <Input
                    id="option-name"
                    placeholder="e.g. Revuelta"
                    value={firstOptionName}
                    onChange={(e) => setFirstOptionName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="option-price">Price delta ($)</Label>
                  <Input
                    id="option-price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={firstOptionPrice}
                    onChange={(e) => setFirstOptionPrice(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
