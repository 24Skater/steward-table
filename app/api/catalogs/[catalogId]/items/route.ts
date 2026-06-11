import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";

async function resolveCatalogChurchId(catalogId: string): Promise<string | null> {
  const catalog = await db.catalog.findUnique({
    where: { id: catalogId },
    select: { churchId: true },
    ...({ _bypassTenancyCheck: true } as object),
  });
  return catalog?.churchId ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { catalogId } = await params;

  const churchId = await resolveCatalogChurchId(catalogId);
  if (!churchId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("catalog.read", {
    userId: session.user.id,
    churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await db.catalogItem.findMany({
    where: { catalogId },
    orderBy: { sortOrder: "asc" },
    select: {
      itemId: true,
      priceOverride: true,
      isAvailable: true,
      item: {
        select: {
          id: true,
          name: true,
          defaultPrice: true,
          status: true,
        },
      },
    },
    ...({ _bypassTenancyCheck: true } as object),
  });

  return NextResponse.json(items);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { catalogId } = await params;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.itemId !== "string" || !body.itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  const churchId = await resolveCatalogChurchId(catalogId);
  if (!churchId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("catalog.edit", {
    userId: session.user.id,
    churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const catalogItem = await db.catalogItem.create({
    data: { catalogId, itemId: body.itemId as string },
    ...({ _bypassTenancyCheck: true } as object),
  });

  return NextResponse.json(catalogItem, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { catalogId } = await params;

  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  const churchId = await resolveCatalogChurchId(catalogId);
  if (!churchId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("catalog.edit", {
    userId: session.user.id,
    churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.catalogItem.delete({
    where: { catalogId_itemId: { catalogId, itemId } },
    ...({ _bypassTenancyCheck: true } as object),
  });

  return new NextResponse(null, { status: 204 });
}
