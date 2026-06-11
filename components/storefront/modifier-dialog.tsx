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
  itemBasePrice: number;
  modifierGroups: ModifierGroup[];
  onConfirm: (modifiers: CartModifier[], totalPrice: number) => void;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ModifierDialog({
  open,
  onClose,
  itemName,
  itemBasePrice,
  modifierGroups,
  onConfirm,
}: ModifierDialogProps) {
  const [selections, setSelections] = useState<Record<string, string[]>>(() => {
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

  const allRequiredMet = modifierGroups
    .filter((g) => g.isRequired)
    .every((g) => (selections[g.id]?.length ?? 0) >= g.minSelections);

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
    const modifierTotal = modifiers.reduce((s, m) => s + m.priceDelta, 0);
    onConfirm(modifiers, itemBasePrice + modifierTotal);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{itemName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
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
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:bg-slate-50 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50"
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!allRequiredMet}
            onClick={handleConfirm}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Add to order — {formatCents(itemBasePrice + Object.values(selections).flat().reduce((s, id) => {
              for (const g of modifierGroups) {
                const opt = g.options.find((o) => o.id === id);
                if (opt) return s + opt.priceDelta;
              }
              return s;
            }, 0))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
