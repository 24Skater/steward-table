import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { Role } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ membershipId: string }>;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
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

  const { membershipId } = await context.params;

  const result = await can("member.update", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
    targetMembershipId: membershipId,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: result.reason ?? "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { roles?: Role[] } | null;
  if (!body?.roles || !Array.isArray(body.roles) || body.roles.length === 0) {
    return NextResponse.json({ error: "roles array is required" }, { status: 400 });
  }

  const validRoles: Role[] = ["OWNER", "ADMIN", "STAFF", "COOK", "DRIVER", "VIEWER"];
  if (!body.roles.every((r) => validRoles.includes(r))) {
    return NextResponse.json({ error: "Invalid role value" }, { status: 400 });
  }

  // Prevent removing OWNER role if this is the last OWNER
  const target = await (db.membership.findFirst as PrismaBypass)({
    where: { id: membershipId, churchId: membership.churchId },
    _bypassTenancyCheck: true,
  });
  if (!target) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  const isRemovingOwner =
    (target.roles as Role[]).includes("OWNER") && !body.roles.includes("OWNER");

  if (isRemovingOwner) {
    const ownerCount = await (db.membership.count as PrismaBypass)({
      where: {
        churchId: membership.churchId,
        status: "ACTIVE",
        roles: { has: "OWNER" },
      },
      _bypassTenancyCheck: true,
    });
    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last OWNER from the church" },
        { status: 422 },
      );
    }
  }

  const updated = await (db.membership.update as PrismaBypass)({
    where: { id: membershipId },
    data: { roles: body.roles },
    select: {
      id: true,
      roles: true,
      status: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    _bypassTenancyCheck: true,
  });

  return NextResponse.json(updated);
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

  const { membershipId } = await context.params;

  const result = await can("member.remove", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
    targetMembershipId: membershipId,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: result.reason ?? "Forbidden" }, { status: 403 });
  }

  // Cannot remove yourself if you are the last OWNER
  const target = await (db.membership.findFirst as PrismaBypass)({
    where: { id: membershipId, churchId: membership.churchId },
    _bypassTenancyCheck: true,
  });
  if (!target) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  if (target.userId === session.user.id) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 422 });
  }

  if ((target.roles as Role[]).includes("OWNER")) {
    const ownerCount = await (db.membership.count as PrismaBypass)({
      where: {
        churchId: membership.churchId,
        status: "ACTIVE",
        roles: { has: "OWNER" },
      },
      _bypassTenancyCheck: true,
    });
    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last OWNER from the church" },
        { status: 422 },
      );
    }
  }

  await (db.membership.update as PrismaBypass)({
    where: { id: membershipId },
    data: { status: "REMOVED" },
    _bypassTenancyCheck: true,
  });

  return new NextResponse(null, { status: 204 });
}
