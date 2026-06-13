"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CartPage() {
  const params = useParams<{ churchSlug: string }>();
  const churchSlug = params.churchSlug;
  const { items, removeItem, updateQuantity, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-xl font-semibold text-slate-700">Your cart is empty</p>
        <p className="mt-2 text-sm text-slate-400">Add items from the menu to get started.</p>
        <Link href={`/${churchSlug}/menu`} className="mt-6">
          <Button className="bg-emerald-600 hover:bg-emerald-700">Browse menu</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Your order</h1>

      <ul className="space-y-4">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium text-slate-800">{item.itemName}</p>
                {item.modifiers.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {item.modifiers.map((m, i) => (
                      <li key={i} className="text-xs text-slate-500">
                        {m.optionName}
                        {m.priceDelta !== 0 && (
                          <span className="ml-1 text-slate-400">
                            ({m.priceDelta > 0 ? "+" : ""}
                            {formatCents(m.priceDelta)})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold text-emerald-700">
                  {formatCents(item.totalPrice)}
                </p>
                <p className="text-xs text-slate-400">
                  {formatCents(item.basePrice + item.modifiers.reduce((s, m) => s + m.priceDelta, 0))} each
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  aria-label="Decrease quantity"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-6 text-center text-sm font-medium text-slate-800">
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
              <button
                onClick={() => removeItem(item.id)}
                aria-label="Remove item"
                className="text-slate-400 transition-colors hover:text-rose-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-700">Subtotal</span>
          <span className="font-semibold text-slate-800">{formatCents(total)}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">Taxes and fees calculated at checkout</p>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link href={`/${churchSlug}/menu`}>
          <Button variant="outline" className="w-full sm:w-auto">
            Add more items
          </Button>
        </Link>
        <Link href={`/${churchSlug}/checkout`}>
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto">
            Proceed to checkout
          </Button>
        </Link>
      </div>
    </div>
  );
}
