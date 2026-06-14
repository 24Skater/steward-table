import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string; itemModifierGroupId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { itemId, itemModifierGroupId } = await params;

  const item = await db.item.findUnique({
    where: { id: itemId },
    select: { churchId: true },
    ...({ _bypassTenancyCheck: true } as object),
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === item.churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("catalog.edit", {
    userId: session.user.id,
    churchId: item.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const binding = await db.itemModifierGroup.findFirst({
    where: { id: itemModifierGroupId, itemId },
    ...({ _bypassTenancyCheck: true } as object),
  });
  if (!binding) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.itemModifierGroup.delete({
    where: { id: itemModifierGroupId },
    ...({ _bypassTenancyCheck: true } as object),
  });

  return new NextResponse(null, { status: 204 });
}
