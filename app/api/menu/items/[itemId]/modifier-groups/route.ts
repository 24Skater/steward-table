import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z.object({
  name: z.string().min(1).max(200),
  required: z.boolean().optional().default(false),
  minSelections: z.number().int().min(0).optional().default(0),
  maxSelections: z.number().int().min(1).optional().default(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
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

  const { itemId } = await params;

  // Verify item belongs to this church
  const item = await db.item.findFirst({
    where: { id: itemId, churchId: membership.churchId, deletedAt: null },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
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

  const { name, required, minSelections, maxSelections } = parsed.data;

  // Create the shared ModifierGroup first, then bind it to the item
  const group = await db.modifierGroup.create({
    data: {
      churchId: membership.churchId,
      name,
      defaultIsRequired: required,
      defaultMinSelections: minSelections,
      defaultMaxSelections: maxSelections,
    },
    select: {
      id: true,
      name: true,
      defaultMinSelections: true,
      defaultMaxSelections: true,
      defaultIsRequired: true,
    },
  });

  // Get the current max sort order for this item's modifier groups
  const lastBinding = await (db.itemModifierGroup.findFirst as PrismaBypass)({
    where: { itemId, deletedAt: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const nextSortOrder = lastBinding ? (lastBinding.sortOrder as number) + 1 : 0;

  const binding = await (db.itemModifierGroup.create as PrismaBypass)({
    data: {
      itemId,
      groupId: group.id,
      sortOrder: nextSortOrder,
    },
    select: {
      id: true,
      sortOrder: true,
      overrideMin: true,
      overrideMax: true,
      overrideIsRequired: true,
    },
  });

  return NextResponse.json(
    {
      success: true,
      binding: {
        ...binding,
        group: { ...group, options: [] },
      },
    },
    { status: 201 },
  );
}
