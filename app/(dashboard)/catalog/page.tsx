import { CatalogList } from "@/components/catalog/catalog-list";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function CatalogPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: { status: string; churchId: string }) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const rawCatalogs = await db.catalog.findMany({
    where: { churchId: membership.churchId },
    select: {
      id: true,
      name: true,
      description: true,
      translations: true,
      status: true,
      opensAt: true,
      closesAt: true,
      _count: { select: { items: true, orders: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Revenue: sum confirmed+ order totals per catalog
  let revenueMap = new Map<string, number>();
  try {
    const revenueRows = await db.order.groupBy({
      by: ["catalogId"],
      where: {
        churchId: membership.churchId,
        status: { notIn: ["DRAFT", "CANCELED"] },
      },
      _sum: { total: true },
    });
    revenueMap = new Map(revenueRows.map((r) => [r.catalogId, r._sum.total ?? 0]));
  } catch {
    // Revenue aggregation is best-effort; continue without it
  }

  const catalogs = rawCatalogs.map((c) => ({
    ...c,
    isActive: c.status === "OPEN",
    revenue: revenueMap.get(c.id) ?? 0,
  }));

  return (
    <main className="p-6 space-y-6">
      <CatalogList initialCatalogs={catalogs} churchId={membership.churchId} />
    </main>
  );
}
