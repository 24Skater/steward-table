import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";

async function resolveCatalogChurchId(catalogId: string): Promise<string | null> {
  const catalog = await db.catalog.findUnique({
    where: { id: catalogId },
    select: { churchId: true },
    ...({ _bypassTenancyCheck: true } as object),
  });
  return catalog?.churchId ?? null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { catalogId } = await params;

  const body = await req.json().catch(() => null) as { itemIds?: string[] } | null;
  if (!body?.itemIds || !Array.isArray(body.itemIds)) {
    return NextResponse.json({ error: "Missing itemIds array" }, { status: 400 });
  }

  const churchId = await resolveCatalogChurchId(catalogId);
  if (!churchId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("catalog.edit", {
    userId: session.user.id,
    churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.$transaction(
    body.itemIds.map((itemId, index) =>
      db.catalogItem.updateMany({
        where: { catalogId, itemId },
        data: { sortOrder: index },
        ...({ _bypassTenancyCheck: true } as object),
      }),
    ),
  );

  return NextResponse.json({ success: true });
}
