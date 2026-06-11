"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  defaultIsRequired: boolean;
  defaultMinSelections: number;
  defaultMaxSelections: number;
  options: ModifierOption[];
}

interface ItemModifierGroupBinding {
  id: string;
  overrideIsRequired: boolean | null;
  overrideMin: number | null;
  overrideMax: number | null;
  modifierGroup: ModifierGroup;
}

interface ModifierGroupCardProps {
  binding: ItemModifierGroupBinding;
  itemId: string;
}

function formatPriceDelta(cents: number): string {
  if (cents === 0) return "Free";
  const sign = cents > 0 ? "+" : "-";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function ModifierGroupCard({ binding, itemId }: ModifierGroupCardProps) {
  const router = useRouter();
  const { modifierGroup } = binding;

  const isRequired = binding.overrideIsRequired ?? modifierGroup.defaultIsRequired;
  const minSel = binding.overrideMin ?? modifierGroup.defaultMinSelections;
  const maxSel = binding.overrideMax ?? modifierGroup.defaultMaxSelections;

  const [isDeleting, setIsDeleting] = useState(false);

  const [showAddOption, setShowAddOption] = useState(false);
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionPrice, setNewOptionPrice] = useState("");
  const [isAddingOption, setIsAddingOption] = useState(false);
  const [addOptionError, setAddOptionError] = useState<string | null>(null);

  const [deletingOptionId, setDeletingOptionId] = useState<string | null>(null);

  async function handleDeleteGroup() {
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/items/${itemId}/modifier-groups/${binding.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to remove modifier group");
      }
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to remove modifier group");
      setIsDeleting(false);
    }
  }

  async function handleAddOption() {
    if (!newOptionName.trim()) {
      setAddOptionError("Option name is required.");
      return;
    }
    setIsAddingOption(true);
    setAddOptionError(null);

    try {
      const rawPrice = parseFloat(newOptionPrice);
      const priceDelta = isNaN(rawPrice) ? 0 : Math.round(rawPrice * 100);

      const res = await fetch(`/api/modifier-groups/${modifierGroup.id}/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOptionName.trim(), priceDelta }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to add option");
      }

      setNewOptionName("");
      setNewOptionPrice("");
      setShowAddOption(false);
      router.refresh();
    } catch (err: unknown) {
      setAddOptionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsAddingOption(false);
    }
  }

  async function handleDeleteOption(optionId: string) {
    setDeletingOptionId(optionId);
    try {
      const res = await fetch(
        `/api/modifier-groups/${modifierGroup.id}/options/${optionId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to delete option");
      }
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete option");
    } finally {
      setDeletingOptionId(null);
    }
  }

  function cancelAddOption() {
    setShowAddOption(false);
    setNewOptionName("");
    setNewOptionPrice("");
    setAddOptionError(null);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-slate-900 text-sm truncate">
            {modifierGroup.name}
          </span>
          <Badge variant={isRequired ? "default" : "secondary"} className="text-xs shrink-0">
            {isRequired ? "Required" : "Optional"}
          </Badge>
          <span className="text-xs text-slate-400 shrink-0">
            {minSel}–{maxSel} selections
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-400 hover:text-red-500 shrink-0"
          onClick={handleDeleteGroup}
          disabled={isDeleting}
          aria-label={`Remove ${modifierGroup.name} from item`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Options list */}
      <div className="px-4 py-2 space-y-1">
        {modifierGroup.options.length === 0 && !showAddOption && (
          <p className="text-xs text-slate-400 py-1">No options yet.</p>
        )}
        {modifierGroup.options.map((opt) => (
          <div
            key={opt.id}
            className="flex items-center justify-between py-1 group"
          >
            <span className="text-sm text-slate-700">{opt.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 tabular-nums">
                {formatPriceDelta(opt.priceDelta)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDeleteOption(opt.id)}
                disabled={deletingOptionId === opt.id}
                aria-label={`Delete option ${opt.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}

        {/* Inline add option form */}
        {showAddOption && (
          <div className="pt-1 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                className="h-7 text-sm flex-1"
                placeholder="Option name"
                value={newOptionName}
                onChange={(e) => setNewOptionName(e.target.value)}
                disabled={isAddingOption}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAddOption();
                  }
                  if (e.key === "Escape") cancelAddOption();
                }}
              />
              <Input
                className="h-7 text-sm w-24"
                type="number"
                step="0.01"
                placeholder="$0.00"
                value={newOptionPrice}
                onChange={(e) => setNewOptionPrice(e.target.value)}
                disabled={isAddingOption}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAddOption();
                  }
                  if (e.key === "Escape") cancelAddOption();
                }}
              />
              <Button
                size="icon"
                className="h-7 w-7"
                onClick={() => void handleAddOption()}
                disabled={isAddingOption}
                aria-label="Confirm add option"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={cancelAddOption}
                disabled={isAddingOption}
                aria-label="Cancel add option"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {addOptionError && (
              <p className="text-xs text-red-600">{addOptionError}</p>
            )}
          </div>
        )}
      </div>

      {/* Add option footer */}
      {!showAddOption && (
        <div className="px-4 pb-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-slate-500 hover:text-slate-700 px-1"
            onClick={() => setShowAddOption(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add option
          </Button>
        </div>
      )}
    </div>
  );
}
