import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";
import { Role } from "@prisma/client";

interface PostBody {
  email: string;
}

export async function POST(req: NextRequest) {
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

  const canInvite = await can("member.invite", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles as Role[],
  });

  if (!canInvite.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as PostBody | null;
  if (!body?.email || typeof body.email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();

  // Check if a user with this email exists
  const existingUser = await (db.user.findUnique as Function)({
    where: { email },
    select: { id: true },
    ...({ _bypassTenancyCheck: true } as object),
  }) as { id: string } | null;

  if (!existingUser) {
    return NextResponse.json(
      { invited: false, message: "No account found for that email" },
      { status: 200 },
    );
  }

  // Check if they already have a membership for this church
  const existingMembership = await (db.membership.findFirst as Function)({
    where: { userId: existingUser.id, churchId: membership.churchId },
    select: { id: true, status: true },
    ...({ _bypassTenancyCheck: true } as object),
  }) as { id: string; status: string } | null;

  if (existingMembership) {
    return NextResponse.json(
      { invited: false, message: "This user is already a member of your church" },
      { status: 200 },
    );
  }

  // Create membership with VIEWER role (ACTIVE — direct addition, no email invite flow)
  await (db.membership.create as Function)({
    data: {
      userId: existingUser.id,
      churchId: membership.churchId,
      roles: [Role.VIEWER],
    },
    ...({ _bypassTenancyCheck: true } as object),
  });

  return NextResponse.json({ invited: true });
}
