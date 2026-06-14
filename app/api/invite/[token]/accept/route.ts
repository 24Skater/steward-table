import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { token } = await params;

  const invitation = await (db.invitation.findUnique as PrismaBypass)({
    where: { token },
    _bypassTenancyCheck: true,
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
  }

  if (invitation.status === "ACCEPTED") {
    return NextResponse.json({ error: "Invitation already accepted" }, { status: 409 });
  }

  const existing = await (db.membership.findFirst as PrismaBypass)({
    where: { userId: session.user.id, churchId: invitation.churchId },
    _bypassTenancyCheck: true,
  });

  if (existing?.status === "ACTIVE") {
    return NextResponse.json({ error: "You are already a member of this church" }, { status: 409 });
  }

  await db.$transaction(async (tx) => {
    await (tx.membership.create as PrismaBypass)({
      data: {
        userId: session.user.id,
        churchId: invitation.churchId,
        roles: [invitation.role],
        status: "ACTIVE",
      },
    });

    await (tx.invitation.update as PrismaBypass)({
      where: { token },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
      _bypassTenancyCheck: true,
    });
  });

  return NextResponse.json({ success: true });
}
