"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ModifierDialog } from "@/components/storefront/modifier-dialog";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/components/ui/toast";
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

export interface ItemCardProps {
  itemId: string;
  catalogId: string;
  name: string;
  description: string | null;
  price: number; // cents
  imageUrl: string | null;
  modifierGroups: ModifierGroup[];
  isAvailable?: boolean;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ItemCard({
  itemId,
  catalogId,
  name,
  description,
  price,
  imageUrl,
  modifierGroups,
  isAvailable = true,
}: ItemCardProps) {
  const { addItem } = useCart();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const hasRequiredModifiers = modifierGroups.some((g) => g.isRequired);
  const hasAnyModifiers = modifierGroups.length > 0;

  function handleAddClick() {
    if (!isAvailable) return;
    if (hasAnyModifiers) {
      setDialogOpen(true);
    } else {
      addItem({
        itemId,
        catalogId,
        itemName: name,
        quantity: 1,
        basePrice: price,
        modifiers: [],
        totalPrice: price,
      });
      toast(`Added 1 × ${name}`);
    }
  }

  function handleModifierConfirm(modifiers: CartModifier[], unitPrice: number, qty: number) {
    addItem({
      itemId,
      catalogId,
      itemName: name,
      quantity: qty,
      basePrice: price,
      modifiers,
      totalPrice: unitPrice * qty,
      modifierGroupDefs: modifierGroups.length > 0 ? modifierGroups : undefined,
    });
    setDialogOpen(false);
    toast(`Added ${qty > 1 ? `${qty} × ` : ""}${name}`);
  }

  return (
    <>
      <div
        role={isAvailable ? "button" : undefined}
        tabIndex={isAvailable ? 0 : undefined}
        onClick={handleAddClick}
        onKeyDown={(e) => { if (isAvailable && (e.key === "Enter" || e.key === " ")) handleAddClick(); }}
        className={`group relative flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden ${isAvailable ? "cursor-pointer transition-shadow hover:shadow-md" : "cursor-default opacity-70"}`}
      >
        {/* Sold-out overlay */}
        {!isAvailable && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60">
            <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              Sold out
            </span>
          </div>
        )}

        {imageUrl ? (
          <div className="h-36 w-full overflow-hidden bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="flex h-36 w-full items-center justify-center bg-slate-50 text-sm font-medium text-slate-400">
            {name}
          </div>
        )}
        <div className="flex flex-col flex-1 p-4">
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800">{name}</h3>
            {description && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{description}</p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-base font-semibold text-emerald-700">{formatCents(price)}</span>
            {isAvailable && (
              <div
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                aria-hidden="true"
              >
                {hasRequiredModifiers ? "Customize" : "Add"}
              </div>
            )}
          </div>
        </div>
      </div>

      {hasAnyModifiers && (
        <ModifierDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          itemName={name}
          itemDescription={description}
          itemBasePrice={price}
          modifierGroups={modifierGroups}
          onConfirm={handleModifierConfirm}
        />
      )}
    </>
  );
}
