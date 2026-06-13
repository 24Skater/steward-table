import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { KitchenDisplay } from "@/components/kitchen/kitchen-display";

export default async function KitchenSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!membership) redirect("/auth/sign-in");

  const { slug } = await params;
  const kitchen = await db.kitchen.findFirst({
    where: { churchId: membership.churchId, slug },
    select: { name: true, slug: true },
  });
  if (!kitchen) notFound();

  return <KitchenDisplay slug={kitchen.slug} kitchenName={kitchen.name} />;
}
