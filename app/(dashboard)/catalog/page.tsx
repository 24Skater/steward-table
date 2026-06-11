import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CatalogList } from "@/components/catalog/catalog-list";

export default async function CatalogPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: { status: string; churchId: string }) => m.status === "ACTIVE"
  );
  if (!membership) redirect("/auth/sign-in");

  const catalogs = await db.catalog.findMany({
    where: { churchId: membership.churchId },
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="p-6 space-y-6">
      <CatalogList
        initialCatalogs={catalogs}
        churchId={membership.churchId}
      />
    </main>
  );
}
