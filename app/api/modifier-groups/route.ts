import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const churchId = request.nextUrl.searchParams.get("churchId");
  if (!churchId) {
    return NextResponse.json({ error: "churchId required" }, { status: 400 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rbac = await can("catalog.edit", {
    userId: session.user.id,
    churchId,
    roles: membership.roles,
  });
  if (!rbac.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const groups = await db.modifierGroup.findMany({
    where: { churchId, deletedAt: null },
    select: {
      id: true,
      name: true,
      defaultMinSelections: true,
      defaultMaxSelections: true,
      defaultIsRequired: true,
      _count: {
        select: {
          options: { where: { deletedAt: null } },
          itemBindings: { where: { deletedAt: null } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(groups);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (
    !body ||
    typeof body.churchId !== "string" ||
    typeof body.name !== "string" ||
    !body.name.trim()
  ) {
    return NextResponse.json({ error: "churchId and name required" }, { status: 400 });
  }

  const { churchId, name } = body;

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rbac = await can("catalog.edit", {
    userId: session.user.id,
    churchId,
    roles: membership.roles,
  });
  if (!rbac.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const minSelections =
    typeof body.defaultMinSelections === "number" ? body.defaultMinSelections : 0;
  const maxSelections =
    typeof body.defaultMaxSelections === "number" ? body.defaultMaxSelections : 1;
  const isRequired = typeof body.defaultIsRequired === "boolean" ? body.defaultIsRequired : false;

  const group = await db.modifierGroup.create({
    data: {
      churchId,
      name: (name as string).trim(),
      defaultMinSelections: Math.max(0, minSelections),
      defaultMaxSelections: Math.max(1, maxSelections),
      defaultIsRequired: isRequired,
    },
  });

  return NextResponse.json(group, { status: 201 });
}
