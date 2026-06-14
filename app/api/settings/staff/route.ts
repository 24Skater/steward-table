import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";
import { Role, MembershipStatus } from "@prisma/client";

interface PatchBody {
  membershipId: string;
  roles?: Role[];
  status?: MembershipStatus;
}

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

  const body = await req.json().catch(() => null) as PatchBody | null;
  if (!body?.membershipId) {
    return NextResponse.json({ error: "membershipId is required" }, { status: 400 });
  }

  const { membershipId, roles, status } = body;

  // Fetch the target membership to validate it belongs to this church
  const target = await (db.membership.findFirst as PrismaBypass)({
    where: { id: membershipId, churchId: membership.churchId },
    ...({ _bypassTenancyCheck: true } as object),
  }) as { id: string; userId: string; roles: Role[]; status: string } | null;

  if (!target) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  // Cannot modify OWNER memberships
  if (target.roles.includes(Role.OWNER)) {
    return NextResponse.json(
      { error: "Cannot modify an OWNER membership" },
      { status: 403 },
    );
  }

  // Cannot deactivate self
  if (status && target.userId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot change your own membership status" },
      { status: 403 },
    );
  }

  // RBAC check — use member.update for roles, member.remove-equivalent status
  const canUpdate = await can("member.update", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles as Role[],
    targetMembershipId: membershipId,
  });

  if (!canUpdate.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Prevent assigning OWNER role via this endpoint
  if (roles && roles.includes(Role.OWNER)) {
    return NextResponse.json(
      { error: "Cannot assign the OWNER role" },
      { status: 403 },
    );
  }

  // Build update data
  const updateData: { roles?: Role[]; status?: MembershipStatus } = {};
  if (roles !== undefined) updateData.roles = roles;
  if (status !== undefined) updateData.status = status;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await (db.membership.update as PrismaBypass)({
    where: { id: membershipId },
    data: updateData,
    ...({ _bypassTenancyCheck: true } as object),
  });

  return NextResponse.json(updated);
}
