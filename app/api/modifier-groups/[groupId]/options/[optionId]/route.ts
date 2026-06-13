import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ groupId: string; optionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { groupId, optionId } = await params;

  const group = await db.modifierGroup.findUnique({
    where: { id: groupId },
    select: { churchId: true },
    ...({ _bypassTenancyCheck: true } as object),
  });
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === group.churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("catalog.edit", {
    userId: session.user.id,
    churchId: group.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const option = await db.modifierOption.findFirst({
    where: { id: optionId, groupId },
    ...({ _bypassTenancyCheck: true } as object),
  });
  if (!option) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.modifierOption.delete({
    where: { id: optionId },
    ...({ _bypassTenancyCheck: true } as object),
  });

  return new NextResponse(null, { status: 204 });
}
