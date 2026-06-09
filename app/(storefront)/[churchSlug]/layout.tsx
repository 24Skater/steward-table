import { notFound } from "next/navigation";
import { db } from "@/lib/db";

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
    // @ts-expect-error bypass tenancy for public storefront church lookup
    _bypassTenancyCheck: true,
  });

  if (!church) {
    notFound();
  }

  return (
    <div data-church-id={church.id}>
      {children}
    </div>
  );
}
