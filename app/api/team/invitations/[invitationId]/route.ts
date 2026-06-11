import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";

interface RouteContext {
  params: Promise<{ invitationId: string }>;
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
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

  const result = await can("member.invite", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: result.reason ?? "Forbidden" }, { status: 403 });
  }

  const { invitationId } = await context.params;

  const invitation = await (db.invitation.findFirst as Function)({
    where: {
      id: invitationId,
      churchId: membership.churchId,
    },
    _bypassTenancyCheck: true,
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invitation.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only PENDING invitations can be revoked" },
      { status: 422 },
    );
  }

  await (db.invitation.update as Function)({
    where: { id: invitationId },
    data: { status: "REVOKED" },
    _bypassTenancyCheck: true,
  });

  return new NextResponse(null, { status: 204 });
}
