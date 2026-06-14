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

  const zones = await (db.deliveryZone.findMany as PrismaBypass)({
    where: { churchId: membership.churchId },
    select: {
      id: true,
      name: true,
      postalCodes: true,
      feeCents: true,
      minOrderCents: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(zones);
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
    postalCodes?: string[];
    feeCents?: number;
    minOrderCents?: number;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, postalCodes, feeCents, minOrderCents } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!Array.isArray(postalCodes) || postalCodes.length === 0) {
    return NextResponse.json({ error: "At least one postal code is required" }, { status: 400 });
  }
  if (typeof feeCents !== "number" || feeCents < 0) {
    return NextResponse.json({ error: "feeCents must be a non-negative integer" }, { status: 400 });
  }
  if (typeof minOrderCents !== "number" || minOrderCents < 0) {
    return NextResponse.json(
      { error: "minOrderCents must be a non-negative integer" },
      { status: 400 },
    );
  }

  const zone = await (db.deliveryZone.create as PrismaBypass)({
    data: {
      churchId: membership.churchId,
      name: name.trim(),
      postalCodes,
      feeCents,
      minOrderCents,
    },
    select: {
      id: true,
      name: true,
      postalCodes: true,
      feeCents: true,
      minOrderCents: true,
    },
  });

  return NextResponse.json(zone, { status: 201 });
}

export async function DELETE(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id query parameter" }, { status: 400 });
  }

  const zone = await (db.deliveryZone.findFirst as PrismaBypass)({
    where: { id, churchId: membership.churchId },
    select: { id: true },
  });

  if (!zone) {
    return NextResponse.json({ error: "Delivery zone not found" }, { status: 404 });
  }

  await (db.deliveryZone.update as PrismaBypass)({
    where: { id },
    data: { deletedAt: new Date() },
    _bypassTenancyCheck: true,
  });

  return NextResponse.json({ success: true });
}
