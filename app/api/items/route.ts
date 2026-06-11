import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;

  if (
    !body ||
    typeof body.name !== "string" ||
    !body.name.trim() ||
    typeof body.churchId !== "string" ||
    !body.churchId ||
    typeof body.basePrice !== "number"
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === body.churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("catalog.edit", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const item = await db.item.create({
    data: {
      name: body.name.trim(),
      description:
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null,
      defaultPrice: Math.round((body.basePrice as number) * 100),
      status: body.isAvailable === false ? "INACTIVE" : "ACTIVE",
      churchId: body.churchId as string,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
