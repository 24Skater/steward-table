import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { itemId } = await params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

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

  const group = await db.$transaction(async (tx) => {
    const newGroup = await tx.modifierGroup.create({
      data: {
        name: (body.name as string).trim(),
        churchId: item.churchId,
        defaultIsRequired: (body.required as boolean | undefined) ?? false,
        defaultMinSelections: (body.minSelections as number | undefined) ?? 0,
        defaultMaxSelections: (body.maxSelections as number | undefined) ?? 1,
      },
      ...({ _bypassTenancyCheck: true } as object),
    });

    await tx.itemModifierGroup.create({
      data: {
        itemId,
        groupId: newGroup.id,
        sortOrder: 0,
      },
      ...({ _bypassTenancyCheck: true } as object),
    });

    return newGroup;
  });

  return NextResponse.json(group, { status: 201 });
}
