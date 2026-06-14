import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { CatalogStatus } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

const VALID_STATUSES: CatalogStatus[] = ["DRAFT", "OPEN", "CLOSED", "ARCHIVED"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { catalogId } = await params;

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const status = (body as Record<string, unknown>).status;
  if (typeof status !== "string" || !VALID_STATUSES.includes(status as CatalogStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

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

  const action = status === "OPEN" ? "catalog.publish" : "catalog.edit";
  const result = await can(action, {
    userId: session.user.id,
    churchId: catalog.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.catalog.update({
    where: { id: catalogId },
    data: { status: status as CatalogStatus },
  });

  return NextResponse.json(updated);
}
