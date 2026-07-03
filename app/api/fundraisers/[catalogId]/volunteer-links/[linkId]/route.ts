import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { revokeVolunteerLink } from "@/lib/fundraisers/volunteer-links";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ catalogId: string; linkId: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { catalogId, linkId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const catalog = await db.catalog.findFirst({
    where: { id: catalogId, churchId: membership.churchId },
    select: { id: true, createdById: true },
  });
  if (!catalog) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await can("fundraiser.edit", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
    catalogCreatedById: catalog.createdById ?? undefined,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await revokeVolunteerLink(linkId, membership.churchId);
  return NextResponse.json({ revoked: true });
}
