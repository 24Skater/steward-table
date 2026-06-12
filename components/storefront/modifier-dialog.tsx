"use client";

import { useState, useEffect } from "react";
import { Minus, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { CartModifier } from "@/hooks/use-cart";

interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  options: ModifierOption[];
}

interface ModifierDialogProps {
  open: boolean;
  onClose: () => void;
  itemName: string;
  itemDescription?: string | null;
  itemBasePrice: number;
  modifierGroups: ModifierGroup[];
  initialSelections?: Record<string, string[]>;
  initialQuantity?: number;
  confirmLabel?: string;
  onConfirm: (modifiers: CartModifier[], unitPrice: number, quantity: number) => void;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ModifierDialog({
  open,
  onClose,
  itemName,
  itemDescription,
  itemBasePrice,
  modifierGroups,
  initialSelections,
  initialQuantity = 1,
  confirmLabel,
  onConfirm,
}: ModifierDialogProps) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
    if (initialSelections) return initialSelections;
    const initial: Record<string, string[]> = {};
    for (const group of modifierGroups) {
      const defaults = group.options
        .filter((o) => o.isDefault)
        .map((o) => o.id)
        .slice(0, group.maxSelections);
      initial[group.id] = defaults;
    }
    return initial;
  });

  // Sync state when dialog opens with different initial values (for cart editing)
  useEffect(() => {
    if (!open) return;
    setQuantity(initialQuantity);
    if (initialSelections) {
      setSelections(initialSelections);
    } else {
      const initial: Record<string, string[]> = {};
      for (const group of modifierGroups) {
        const defaults = group.options
          .filter((o) => o.isDefault)
          .map((o) => o.id)
          .slice(0, group.maxSelections);
        initial[group.id] = defaults;
      }
      setSelections(initial);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const allRequiredMet = modifierGroups
    .filter((g) => g.isRequired)
    .every((g) => (selections[g.id]?.length ?? 0) >= g.minSelections);

  const modifierTotal = Object.entries(selections).reduce((sum, [groupId, selectedIds]) => {
    const group = modifierGroups.find((g) => g.id === groupId);
    if (!group) return sum;
    return sum + selectedIds.reduce((s, optId) => {
      const opt = group.options.find((o) => o.id === optId);
      return s + (opt?.priceDelta ?? 0);
    }, 0);
  }, 0);

  function toggleOption(group: ModifierGroup, optionId: string) {
    const current = selections[group.id] ?? [];
    if (group.maxSelections === 1) {
      setSelections({ ...selections, [group.id]: [optionId] });
      return;
    }
    if (current.includes(optionId)) {
      setSelections({ ...selections, [group.id]: current.filter((id) => id !== optionId) });
    } else if (current.length < group.maxSelections) {
      setSelections({ ...selections, [group.id]: [...current, optionId] });
    }
  }

  function handleConfirm() {
    const modifiers: CartModifier[] = [];
    for (const group of modifierGroups) {
      const selectedIds = selections[group.id] ?? [];
      for (const optionId of selectedIds) {
        const option = group.options.find((o) => o.id === optionId);
        if (option) {
          modifiers.push({
            groupName: group.name,
            optionName: option.name,
            priceDelta: option.priceDelta,
          });
        }
      }
    }
    onConfirm(modifiers, itemBasePrice + modifierTotal, quantity);
    setQuantity(1);
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto rounded-t-2xl px-0 pb-0 pt-0"
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        <SheetHeader className="px-5 pb-4">
          <SheetTitle className="text-left text-lg font-bold text-slate-800">
            {itemName}
          </SheetTitle>
          {itemDescription && (
            <p className="mt-1 text-sm text-slate-500">{itemDescription}</p>
          )}
        </SheetHeader>

        <div className="space-y-6 px-5 pb-4">
          {modifierGroups.map((group) => (
            <div key={group.id}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-800">{group.name}</span>
                {group.isRequired && (
                  <span className="text-xs font-medium text-rose-600">Required</span>
                )}
              </div>
              <div className="space-y-2">
                {group.options.map((option) => {
                  const selected = (selections[group.id] ?? []).includes(option.id);
                  const isRadio = group.maxSelections === 1;
                  return (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:bg-slate-50 has-checked:border-emerald-500 has-checked:bg-emerald-50"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type={isRadio ? "radio" : "checkbox"}
                          name={group.id}
                          checked={selected}
                          onChange={() => toggleOption(group, option.id)}
                          className="accent-emerald-600"
                        />
                        <span className="text-sm text-slate-700">{option.name}</span>
                      </div>
                      {option.priceDelta !== 0 && (
                        <span className="text-sm text-slate-500">
                          {option.priceDelta > 0 ? "+" : ""}
                          {formatCents(option.priceDelta)}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 pb-8 pt-4 space-y-3">
          {/* Quantity stepper */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
              disabled={quantity <= 1}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-lg font-semibold text-slate-800">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              aria-label="Increase quantity"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <Button
            disabled={!allRequiredMet}
            onClick={handleConfirm}
            className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 text-base font-semibold disabled:opacity-50"
          >
            {confirmLabel ?? "Add"}{quantity > 1 ? ` ${quantity} × ` : " "}to order — {formatCents((itemBasePrice + modifierTotal) * quantity)}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
