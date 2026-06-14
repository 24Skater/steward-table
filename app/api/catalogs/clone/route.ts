import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    sourceCatalogId?: string;
    name?: string;
    churchId?: string;
  } | null;

  if (!body?.sourceCatalogId || !body?.name || !body?.churchId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === body.churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("catalog.edit", {
    userId: session.user.id,
    churchId: body.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch source catalog and verify it belongs to this church
  const source = await db.catalog.findFirst({
    where: { id: body.sourceCatalogId, churchId: body.churchId },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          itemId: true,
          priceOverride: true,
          sortOrder: true,
          maxQuantityPerOrder: true,
        },
      },
    },
  });

  if (!source) {
    return NextResponse.json({ error: "Source catalog not found" }, { status: 404 });
  }

  const baseSlug = (body.name as string)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${baseSlug}-${Date.now()}`;

  const newCatalog = await db.$transaction(async (tx) => {
    const catalog = await tx.catalog.create({
      data: {
        name: body.name as string,
        slug,
        churchId: body.churchId as string,
        status: "DRAFT",
        description: source.description,
      },
    });

    if (source.items.length > 0) {
      await tx.catalogItem.createMany({
        data: source.items.map((item) => ({
          catalogId: catalog.id,
          itemId: item.itemId,
          priceOverride: item.priceOverride,
          sortOrder: item.sortOrder,
          maxQuantityPerOrder: item.maxQuantityPerOrder,
        })),
      });
    }

    return catalog;
  });

  return NextResponse.json({ catalogId: newCatalog.id }, { status: 201 });
}
