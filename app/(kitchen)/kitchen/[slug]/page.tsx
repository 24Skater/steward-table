import { KitchenDisplay } from "@/components/kitchen/kitchen-display";
import { requireActiveMembership } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export default async function KitchenSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { membership } = await requireActiveMembership();

  const { slug } = await params;
  const kitchen = await db.kitchen.findFirst({
    where: { churchId: membership.churchId, slug },
    select: { name: true, slug: true },
  });
  if (!kitchen) notFound();

  return <KitchenDisplay slug={kitchen.slug} kitchenName={kitchen.name} />;
}
