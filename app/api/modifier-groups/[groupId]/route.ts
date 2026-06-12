import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { groupId } = await params;

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

  const rbac = await can("catalog.edit", {
    userId: session.user.id,
    churchId: group.churchId,
    roles: membership.roles,
  });
  if (!rbac.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.defaultMinSelections === "number") data.defaultMinSelections = Math.max(0, body.defaultMinSelections);
  if (typeof body.defaultMaxSelections === "number") data.defaultMaxSelections = Math.max(1, body.defaultMaxSelections);
  if (typeof body.defaultIsRequired === "boolean") data.defaultIsRequired = body.defaultIsRequired;

  const updated = await db.modifierGroup.update({
    where: { id: groupId },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { groupId } = await params;

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

  const rbac = await can("catalog.edit", {
    userId: session.user.id,
    churchId: group.churchId,
    roles: membership.roles,
  });
  if (!rbac.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.modifierGroup.update({
    where: { id: groupId },
    data: { deletedAt: new Date() },
  });

  return new NextResponse(null, { status: 204 });
}
