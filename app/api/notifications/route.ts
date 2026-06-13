import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SessionMembership } from "@/lib/auth/types";

function getActiveMembership(memberships: SessionMembership[]): SessionMembership | undefined {
  return memberships.find((m) => m.status === "ACTIVE");
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const activeMembership = getActiveMembership(session.user.memberships ?? []);
  if (!activeMembership) {
    return NextResponse.json({ error: "No active membership" }, { status: 403 });
  }

  const notifications = await db.notification.findMany({
    where: {
      churchId: activeMembership.churchId,
      OR: [{ userId: session.user.id }, { userId: null }],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      type: true,
      body: true,
      link: true,
      readAt: true,
      createdAt: true,
    },
  });

  const unread = notifications.filter((n) => n.readAt === null).length;

  return NextResponse.json({
    unread,
    notifications: notifications.map((n) => ({
      ...n,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const activeMembership = getActiveMembership(session.user.memberships ?? []);
  if (!activeMembership) {
    return NextResponse.json({ error: "No active membership" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { id?: string; all?: boolean } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const now = new Date();

  if (body.all === true) {
    await db.notification.updateMany({
      where: {
        churchId: activeMembership.churchId,
        OR: [{ userId: session.user.id }, { userId: null }],
        readAt: null,
      },
      data: { readAt: now },
    });
    return NextResponse.json({ success: true });
  }

  if (typeof body.id === "string" && body.id) {
    await db.notification.update({
      where: {
        id: body.id,
        churchId: activeMembership.churchId,
      },
      data: { readAt: now },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Provide id or all:true" }, { status: 400 });
}
