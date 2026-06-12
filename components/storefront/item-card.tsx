"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ModifierDialog } from "@/components/storefront/modifier-dialog";
import { useCart } from "@/hooks/use-cart";
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
}: ItemCardProps) {
  const { addItem } = useCart();
  const [dialogOpen, setDialogOpen] = useState(false);

  const hasRequiredModifiers = modifierGroups.some((g) => g.isRequired);
  const hasAnyModifiers = modifierGroups.length > 0;

  function handleAddClick() {
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
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleAddClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleAddClick(); }}
        className="group flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md overflow-hidden cursor-pointer"
      >
        {imageUrl && (
          <div className="h-36 w-full overflow-hidden bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
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
            <div
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
              aria-hidden="true"
            >
              {hasRequiredModifiers ? "Customize" : "Add"}
            </div>
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
