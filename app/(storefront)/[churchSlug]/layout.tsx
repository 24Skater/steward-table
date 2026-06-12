import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { CartShell } from "@/components/storefront/cart-shell";
import { ToastProvider } from "@/components/ui/toast";
import { StorefrontMenu } from "@/components/storefront/storefront-menu";

interface StorefrontLayoutProps {
  children: React.ReactNode;
  params: Promise<{ churchSlug: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}): Promise<Metadata> {
  const { churchSlug } = await params;

  const church = await db.church.findFirst({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: { name: true, logoUrl: true },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore bypass tenancy for metadata generation
    _bypassTenancyCheck: true,
  });

  if (!church) return {};

  const catalog = await db.catalog.findFirst({
    where: {
      church: { slug: churchSlug },
      status: "OPEN",
    },
    select: { name: true },
  });

  const title = catalog ? `${church.name} — ${catalog.name}` : church.name;
  const description = catalog
    ? `Order from ${church.name}: ${catalog.name}`
    : `Order from ${church.name}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: church.logoUrl ? [{ url: church.logoUrl }] : [],
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: church.logoUrl ? [church.logoUrl] : [],
    },
  };
}

export default async function StorefrontLayout({
  children,
  params,
}: StorefrontLayoutProps) {
  const { churchSlug } = await params;

  const church = await db.church.findFirst({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: {
      id: true, name: true, slug: true, currency: true, locale: true,
      logoUrl: true, accentColor: true,
      settings: { select: { replyToEmail: true } },
    },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore bypass tenancy for public storefront church lookup
    _bypassTenancyCheck: true,
  });

  if (!church) {
    notFound();
  }

  const openCatalog = await db.catalog.findFirst({
    where: { churchId: church.id, status: "OPEN" },
    select: { name: true, description: true },
    orderBy: { createdAt: "desc" },
  });

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
          <div className="flex items-center gap-1">
            <CartShell churchSlug={churchSlug} />
            <StorefrontMenu
              churchSlug={churchSlug}
              catalogName={openCatalog?.name}
              catalogDescription={openCatalog?.description}
              replyToEmail={church.settings?.replyToEmail}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 pb-28">{children}</main>
    </div>
    </ToastProvider>
  );
}
