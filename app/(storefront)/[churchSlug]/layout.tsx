import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { CartShell } from "@/components/storefront/cart-shell";
import { ToastProvider } from "@/components/ui/toast";

interface StorefrontLayoutProps {
  children: React.ReactNode;
  params: Promise<{ churchSlug: string }>;
}

export default async function StorefrontLayout({
  children,
  params,
}: StorefrontLayoutProps) {
  const { churchSlug } = await params;

  const church = await db.church.findFirst({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: { id: true, name: true, slug: true, currency: true, locale: true, logoUrl: true, accentColor: true },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore bypass tenancy for public storefront church lookup
    _bypassTenancyCheck: true,
  });

  if (!church) {
    notFound();
  }

  return (
    <ToastProvider>
    <div
      className="min-h-screen bg-white"
      data-church-id={church.id}
      style={church.accentColor ? ({ "--color-accent": church.accentColor } as React.CSSProperties) : undefined}
    >
      <header
        className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-sm"
        style={church.accentColor ? { borderBottomColor: church.accentColor } : undefined}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href={`/${churchSlug}/menu`}
            className="text-lg font-semibold text-slate-800 hover:text-slate-600"
          >
            {church.logoUrl ? (
              <img
                src={church.logoUrl}
                alt={church.name}
                style={{ height: 32, width: "auto", maxWidth: 160 }}
              />
            ) : (
              church.name
            )}
          </Link>
          <CartShell churchSlug={churchSlug} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 pb-28">{children}</main>
    </div>
    </ToastProvider>
  );
}
