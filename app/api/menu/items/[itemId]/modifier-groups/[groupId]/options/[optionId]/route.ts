import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string; groupId: string; optionId: string }> },
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

  const { itemId, groupId, optionId } = await params;

  // Verify the binding exists and belongs to this church, and the option is part of that group
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

  const underlyingGroupId = (binding as { group: { id: string } }).group.id;

  const option = await (db.modifierOption.findFirst as PrismaBypass)({
    where: { id: optionId, groupId: underlyingGroupId, deletedAt: null },
    select: { id: true },
  });

  if (!option) {
    return NextResponse.json({ error: "Option not found" }, { status: 404 });
  }

  // Soft-delete (ModifierOption has deletedAt)
  await db.modifierOption.update({
    where: { id: optionId },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
