"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/use-cart";

interface CartButtonProps {
  churchSlug: string;
}

export function CartButton({ churchSlug }: CartButtonProps) {
  const { items } = useCart();
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Link
      href={`/${churchSlug}/cart`}
      className="relative inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
    >
      <ShoppingCart className="h-4 w-4" />
      <span>Cart</span>
      {count > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-xs font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
