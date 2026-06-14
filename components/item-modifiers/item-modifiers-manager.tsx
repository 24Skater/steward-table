"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AddModifierGroupDialog } from "./add-modifier-group-dialog";
import { ModifierGroupCard } from "./modifier-group-card";

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
  sortOrder: number;
  overrideIsRequired: boolean | null;
  overrideMin: number | null;
  overrideMax: number | null;
  modifierGroup: ModifierGroup;
}

interface Item {
  id: string;
  name: string;
  modifierGroups: ItemModifierGroupBinding[];
}

interface ItemModifiersManagerProps {
  item: Item;
  catalogId: string;
  churchId: string;
}

export function ItemModifiersManager({ item, catalogId }: ItemModifiersManagerProps) {
  const [addGroupOpen, setAddGroupOpen] = useState(false);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href={`/catalog/${catalogId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to catalog
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{item.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">Modifier groups</p>
          </div>
          <Button onClick={() => setAddGroupOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add modifier group
          </Button>
        </div>
      </div>

      {/* Modifier groups list */}
      {item.modifierGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-slate-500 text-sm">No modifier groups yet.</p>
          <p className="text-slate-400 text-xs mt-1">
            Add groups like "Pupusa Filling" or "Heat level" to give customers customization
            options.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {item.modifierGroups.map((binding) => (
            <ModifierGroupCard key={binding.id} binding={binding} itemId={item.id} />
          ))}
        </div>
      )}

      <AddModifierGroupDialog open={addGroupOpen} onOpenChange={setAddGroupOpen} itemId={item.id} />
    </div>
  );
}
