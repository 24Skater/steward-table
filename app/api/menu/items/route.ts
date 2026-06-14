import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z.object({
  catalogId: z.string().min(1).optional(),
  name: z.string().min(1, "Name is required").max(200),
  priceCents: z.number().int().min(0, "Price must be non-negative"),
  description: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
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

  const canResult = await can("catalog.edit", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!canResult.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawBody = await req.json().catch(() => null);
  if (!rawBody) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }

  const { catalogId, name, priceCents, description } = parsed.data;

  // If catalogId provided, verify the catalog belongs to this church
  if (catalogId) {
    const catalog = await db.catalog.findFirst({
      where: { id: catalogId, churchId: membership.churchId },
      select: { id: true },
    });
    if (!catalog) {
      return NextResponse.json({ error: "Catalog not found" }, { status: 404 });
    }
  }

  // Create the Item
  const item = await db.item.create({
    data: {
      churchId: membership.churchId,
      name,
      defaultPrice: priceCents,
      ...(description && { description }),
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      description: true,
      defaultPrice: true,
      imageUrl: true,
      status: true,
      _count: { select: { modifierGroups: true } },
    },
  });

  // Optionally link to a catalog
  if (catalogId) {
    const catalogItem = await db.catalogItem.create({
      data: {
        catalogId,
        itemId: item.id,
        sortOrder: 0,
      },
      select: {
        id: true,
        sortOrder: true,
        deletedAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        item,
        catalogItem: {
          id: catalogItem.id,
          sortOrder: catalogItem.sortOrder,
          deletedAt: catalogItem.deletedAt,
          item,
        },
      },
      { status: 201 },
    );
  }

  return NextResponse.json({ success: true, item }, { status: 201 });
}
