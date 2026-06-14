import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";
import type { Role } from "@prisma/client";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("settings.payment", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles as Role[],
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as {
    acceptCash?: boolean;
    acceptZelle?: boolean;
  } | null;

  if (!body || (body.acceptCash === undefined && body.acceptZelle === undefined)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const data: Record<string, boolean> = {};
  if (typeof body.acceptCash === "boolean") data.acceptCash = body.acceptCash;
  if (typeof body.acceptZelle === "boolean") data.acceptZelle = body.acceptZelle;

  await (db.churchSettings.upsert as PrismaBypass)({
    where: { churchId: membership.churchId },
    create: { churchId: membership.churchId, ...data },
    update: data,
    _bypassTenancyCheck: true,
  });

  return NextResponse.json({ success: true, ...data });
}
