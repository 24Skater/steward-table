import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z.object({
  name: z.string().min(1).max(200),
  priceDelta: z.number().int().min(0).optional().default(0),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string; groupId: string }> },
) {
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

  const { itemId, groupId } = await params;

  // Verify the binding exists and belongs to an item owned by this church
  const binding = await (db.itemModifierGroup.findFirst as PrismaBypass)({
    where: { id: groupId, itemId, deletedAt: null },
    include: {
      item: { select: { churchId: true } },
      group: { select: { id: true } },
    },
  });

  if (
    !binding ||
    (binding as { item: { churchId: string } }).item.churchId !== membership.churchId
  ) {
    return NextResponse.json({ error: "Modifier group not found" }, { status: 404 });
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

  const { name, priceDelta } = parsed.data;
  const underlyingGroupId = (binding as { group: { id: string } }).group.id;

  // Get the current max sort order for the options in this group
  const lastOption = await (db.modifierOption.findFirst as PrismaBypass)({
    where: { groupId: underlyingGroupId, deletedAt: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const nextSortOrder = lastOption ? (lastOption.sortOrder as number) + 1 : 0;

  const option = await db.modifierOption.create({
    data: {
      groupId: underlyingGroupId,
      name,
      priceDelta,
      sortOrder: nextSortOrder,
    },
    select: {
      id: true,
      name: true,
      priceDelta: true,
      sortOrder: true,
      isDefault: true,
    },
  });

  return NextResponse.json({ success: true, option }, { status: 201 });
}
