import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { CartButton } from "@/components/storefront/cart-button";
import { CartBar } from "@/components/storefront/cart-bar";

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
    select: { id: true, name: true, slug: true, currency: true, locale: true },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore bypass tenancy for public storefront church lookup
    _bypassTenancyCheck: true,
  });

  if (!church) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white" data-church-id={church.id}>
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href={`/${churchSlug}/menu`}
            className="text-lg font-semibold text-slate-800 hover:text-slate-600"
          >
            {church.name}
          </Link>
          <CartButton churchSlug={churchSlug} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:pb-8">{children}</main>
      <CartBar churchSlug={churchSlug} />
    </div>
  );
}
