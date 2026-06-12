"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, Minus, Plus, Trash2, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";

interface CartShellProps {
  churchSlug: string;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CartShell({ churchSlug }: CartShellProps) {
  const [open, setOpen] = useState(false);
  const { items, removeItem, updateQuantity, total } = useCart();
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <>
      {/* Header cart button */}
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        aria-label="Open cart"
      >
        <ShoppingCart className="h-4 w-4" />
        <span>Cart</span>
        {count > 0 && (
          <>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-xs font-semibold text-white">
              {count}
            </span>
            <span className="hidden text-xs font-semibold text-emerald-700 sm:inline">
              {formatCents(total)}
            </span>
          </>
        )}
      </button>

      {/* Sticky bottom bar — visible when cart is non-empty */}
      {count > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4">
          <button
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-between rounded-xl bg-emerald-600 px-4 py-3.5 shadow-lg transition-colors hover:bg-emerald-700"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold text-white">
                {count}
              </span>
              <span className="text-sm font-semibold text-white">View order</span>
            </div>
            <span className="text-sm font-semibold text-white">{formatCents(total)}</span>
          </button>
        </div>
      )}

      {/* Cart bottom-sheet drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-0 pb-0 pt-0"
        >
          {/* Drag handle */}
          <div className="flex justify-center pb-2 pt-3">
            <div className="h-1 w-10 rounded-full bg-slate-200" />
          </div>

          <SheetHeader className="px-5 pb-3">
            <SheetTitle className="text-left text-lg font-bold text-slate-800">
              Your order
            </SheetTitle>
          </SheetHeader>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-slate-500">Your cart is empty.</p>
              <button
                onClick={() => setOpen(false)}
                className="mt-4 text-sm text-emerald-600 underline-offset-2 hover:underline"
              >
                Browse menu
              </button>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 px-5">
                {items.map((item) => (
                  <li key={item.id} className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-slate-800">{item.itemName}</p>
                        {item.modifiers.length > 0 && (
                          <p className="mt-0.5 truncate text-xs text-slate-400">
                            {item.modifiers.map((m) => m.optionName).join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold text-slate-700">
                          {formatCents(item.totalPrice)}
                        </span>
                        <button
                          onClick={() => removeItem(item.id)}
                          aria-label="Remove item"
                          className="text-slate-300 transition-colors hover:text-rose-400"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        aria-label="Decrease quantity"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-sm font-medium text-slate-800">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Subtotal + checkout */}
              <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 pb-8 pt-4">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-medium text-slate-700">Subtotal</span>
                  <span className="font-semibold text-slate-900">{formatCents(total)}</span>
                </div>
                <Link
                  href={`/${churchSlug}/checkout`}
                  onClick={() => setOpen(false)}
                >
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 text-base font-semibold">
                    Proceed to checkout
                  </Button>
                </Link>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-3 w-full text-center text-sm text-slate-400 hover:text-slate-600"
                >
                  Continue shopping
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
