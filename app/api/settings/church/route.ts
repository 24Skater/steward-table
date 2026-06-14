import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

export async function GET() {
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

  const church = await (db.church.findUnique as PrismaBypass)({
    where: { id: membership.churchId },
    select: {
      id: true,
      name: true,
      slug: true,
      timezone: true,
      settings: {
        select: {
          replyToEmail: true,
        },
      },
    },
    _bypassTenancyCheck: true,
  });

  if (!church) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: church.id,
    name: church.name,
    slug: church.slug,
    timezone: church.timezone,
    contactEmail: church.settings?.replyToEmail ?? null,
  });
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

  const result = await can("church.update", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    contactEmail?: string | null;
    timezone?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const [updatedChurch] = await Promise.all([
    (db.church.update as PrismaBypass)({
      where: { id: membership.churchId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.timezone && { timezone: body.timezone }),
      },
      select: { id: true, name: true, slug: true, timezone: true },
      _bypassTenancyCheck: true,
    }),
    body.contactEmail !== undefined
      ? (db.churchSettings.upsert as PrismaBypass)({
          where: { churchId: membership.churchId },
          create: {
            churchId: membership.churchId,
            replyToEmail: body.contactEmail,
          },
          update: {
            replyToEmail: body.contactEmail,
          },
          _bypassTenancyCheck: true,
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    id: updatedChurch.id,
    name: updatedChurch.name,
    slug: updatedChurch.slug,
    timezone: updatedChurch.timezone,
    contactEmail: body.contactEmail ?? null,
  });
}
