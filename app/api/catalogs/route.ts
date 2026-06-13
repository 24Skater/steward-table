import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const churchId = req.nextUrl.searchParams.get("churchId");
  if (!churchId) {
    return NextResponse.json({ error: "Missing churchId" }, { status: 400 });
  }

  const catalogs = await db.catalog.findMany({
    where: { churchId },
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(catalogs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as {
    name?: string;
    description?: string | null;
    churchId?: string;
  } | null;

  if (!body?.name || !body?.churchId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === body.churchId && m.status === "ACTIVE"
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("catalog.edit", {
    userId: session.user.id,
    churchId: body.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const slug = body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const catalog = await db.catalog.create({
    data: {
      name: body.name,
      slug,
      description: body.description ?? null,
      churchId: body.churchId,
    },
  });

  return NextResponse.json(catalog, { status: 201 });
}
