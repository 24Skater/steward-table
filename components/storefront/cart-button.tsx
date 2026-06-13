"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useStorefrontStrings } from "@/components/storefront/storefront-locale-provider";

interface CartButtonProps {
  churchSlug: string;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CartButton({ churchSlug }: CartButtonProps) {
  const { items, total } = useCart();
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const s = useStorefrontStrings();

  return (
    <Link
      href={`/${churchSlug}/cart`}
      className="relative inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
    >
      <ShoppingCart className="h-4 w-4" />
      <span>{s.cart}</span>
      {count > 0 && (
        <>
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold text-white"
            style={{ backgroundColor: "var(--color-accent, #10b981)" }}
          >
            {count}
          </span>
          <span
            className="hidden text-xs font-semibold sm:inline"
            style={{ color: "var(--color-accent, #10b981)" }}
          >
            {formatCents(total)}
          </span>
        </>
      )}
    </Link>
  );
}
