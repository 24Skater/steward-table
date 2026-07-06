import { FundraiserWizard } from "@/components/fundraisers/fundraiser-wizard";
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ cloneFrom?: string }>;
}

export default async function NewFundraiserPage({ searchParams }: PageProps) {
  const { cloneFrom } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const permitted = await can("fundraiser.create", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!permitted.allowed) redirect("/catalog");

  const [ministries, kitchens] = await Promise.all([
    db.ministry.findMany({
      where: { churchId: membership.churchId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.kitchen.findMany({
      where: { churchId: membership.churchId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <main className="p-6">
      <FundraiserWizard
        churchId={membership.churchId}
        ministries={ministries}
        kitchens={kitchens}
        cloneFromCatalogId={cloneFrom ?? null}
      />
    </main>
  );
}
