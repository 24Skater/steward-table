"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ClipboardList, Info, Mail, Menu, X } from "lucide-react";
import { useState } from "react";

interface StorefrontMenuProps {
  churchSlug: string;
  catalogName?: string | null;
  catalogDescription?: string | null;
  replyToEmail?: string | null;
}

export function StorefrontMenu({
  churchSlug,
  catalogName,
  catalogDescription,
  replyToEmail,
}: StorefrontMenuProps) {
  const [open, setOpen] = useState(false);

  const hasRecentOrder =
    typeof window !== "undefined" && !!localStorage.getItem(`steward-last-order-${churchSlug}`);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-72 px-0 pb-0 pt-0">
          <div className="flex items-center justify-between px-5 pb-3 pt-6">
            <SheetTitle className="text-base font-semibold text-slate-800">Menu</SheetTitle>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="rounded-md p-1 text-slate-400 transition-colors hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="divide-y divide-slate-100">
            {catalogDescription && (
              <div className="px-5 py-4">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Info className="h-3.5 w-3.5" />
                  {catalogName ?? "About this sale"}
                </div>
                <p className="text-sm text-slate-600">{catalogDescription}</p>
              </div>
            )}

            {replyToEmail && (
              <a
                href={`mailto:${replyToEmail}`}
                className="flex items-center gap-3 px-5 py-4 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                Contact the church
              </a>
            )}

            {hasRecentOrder && (
              <a
                href={`/${churchSlug}/orders`}
                className="flex items-center gap-3 px-5 py-4 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                <ClipboardList className="h-4 w-4 shrink-0 text-slate-400" />
                View my order
              </a>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
