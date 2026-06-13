import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { SessionMembership } from "@/lib/auth/types";
import { CatalogItemsManager } from "@/components/catalog-items";

export default async function CatalogDetailPage({
  params,
}: {
  params: Promise<{ catalogId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const { catalogId } = await params;

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const catalog = await db.catalog.findFirst({
    where: { id: catalogId, churchId: membership.churchId },
    include: {
      items: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          item: {
            include: {
              modifierGroups: {
                where: { deletedAt: null },
                orderBy: { sortOrder: "asc" },
                include: {
                  group: {
                    include: {
                      options: {
                        where: { deletedAt: null },
                        orderBy: { sortOrder: "asc" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!catalog) notFound();

  return (
    <main className="p-6 space-y-6">
      <CatalogItemsManager
        catalog={catalog}
        churchId={membership.churchId}
      />
    </main>
  );
}
