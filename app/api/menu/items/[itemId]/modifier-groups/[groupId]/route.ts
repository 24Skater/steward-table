import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";

export async function DELETE(
  _req: NextRequest,
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
    },
  });

  if (!binding || (binding as { item: { churchId: string } }).item.churchId !== membership.churchId) {
    return NextResponse.json({ error: "Modifier group not found" }, { status: 404 });
  }

  // Soft-delete the binding (ItemModifierGroup has deletedAt)
  await (db.itemModifierGroup.update as PrismaBypass)({
    where: { id: groupId },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
