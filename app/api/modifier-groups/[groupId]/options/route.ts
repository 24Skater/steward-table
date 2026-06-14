import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { groupId } = await params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

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

  const priceDelta = typeof body.priceDelta === "number" ? Math.round(body.priceDelta) : 0;

  const option = await db.modifierOption.create({
    data: {
      groupId,
      name: (body.name as string).trim(),
      priceDelta,
      sortOrder: (body.sortOrder as number | undefined) ?? 0,
    },
    ...({ _bypassTenancyCheck: true } as object),
  });

  return NextResponse.json(option, { status: 201 });
}
