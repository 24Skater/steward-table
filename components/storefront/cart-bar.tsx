"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useStorefrontStrings } from "@/components/storefront/storefront-locale-provider";

interface CartBarProps {
  churchSlug: string;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CartBar({ churchSlug }: CartBarProps) {
  const { items, total } = useCart();
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const s = useStorefrontStrings();

  if (count === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 sm:hidden">
      <Link
        href={`/${churchSlug}/cart`}
        className="flex items-center justify-between rounded-xl px-4 py-3.5 shadow-lg transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--color-accent, #10b981)" }}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold text-white">
            {count}
          </span>
          <span className="text-sm font-semibold text-white">{s.viewCartBar}</span>
        </div>
        <span className="text-sm font-semibold text-white">{formatCents(total)}</span>
      </Link>
    </div>
  );
}
