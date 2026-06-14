import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

async function getAuthSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { catalogId } = await params;
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    description?: string | null;
    translations?: Record<string, unknown> | null;
    opensAt?: string | null;
    closesAt?: string | null;
  } | null;

  const catalog = await db.catalog.findUnique({
    where: { id: catalogId },
    select: { churchId: true },
    ...({ _bypassTenancyCheck: true } as object),
  });

  if (!catalog) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === catalog.churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("catalog.edit", {
    userId: session.user.id,
    churchId: catalog.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.catalog.update({
    where: { id: catalogId, churchId: catalog.churchId },
    data: {
      ...(body?.name !== undefined && { name: body.name }),
      ...(body?.description !== undefined && { description: body.description }),
      ...(body?.translations !== undefined && {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        translations: body.translations as any,
      }),
      ...(body?.opensAt !== undefined && {
        opensAt: body.opensAt ? new Date(body.opensAt) : null,
      }),
      ...(body?.closesAt !== undefined && {
        closesAt: body.closesAt ? new Date(body.closesAt) : null,
      }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { catalogId } = await params;

  const catalog = await db.catalog.findUnique({
    where: { id: catalogId },
    select: { churchId: true },
    ...({ _bypassTenancyCheck: true } as object),
  });

  if (!catalog) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === catalog.churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("catalog.edit", {
    userId: session.user.id,
    churchId: catalog.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.catalog.update({
    where: { id: catalogId, churchId: catalog.churchId },
    data: { deletedAt: new Date() },
  });

  return new NextResponse(null, { status: 204 });
}
