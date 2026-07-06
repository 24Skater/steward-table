import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const churchId = req.nextUrl.searchParams.get("churchId");
  if (!churchId) {
    return NextResponse.json({ error: "Missing churchId" }, { status: 400 });
  }
  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ministries = await db.ministry.findMany({
    where: { churchId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(ministries);
}

const createSchema = z.object({
  churchId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { churchId, name } = parsed.data;

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await can("fundraiser.create", {
    userId: session.user.id,
    churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Create-on-the-fly combobox semantics: case-insensitive match returns existing.
  // The DB unique constraint on (churchId, name) is case-sensitive, so "youth" vs
  // "Youth" would otherwise create near-duplicate ministries and wreck per-ministry
  // reporting. With this insensitive pre-check, typing "youth" returns existing "Youth".
  const existing = await db.ministry.findFirst({
    where: { churchId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (existing) {
    return NextResponse.json(existing);
  }

  try {
    const ministry = await db.ministry.create({
      data: { churchId, name },
      select: { id: true, name: true },
    });
    return NextResponse.json(ministry, { status: 201 });
  } catch (err) {
    // Handle concurrent-create race on the (churchId, name) unique constraint.
    // Check both the Prisma error code and the message-based idiom used elsewhere
    // in this repo (create-storefront-order.ts, kitchens/actions.ts) since $extends
    // can rewrap errors.
    const isUniqueViolation =
      (err as { code?: string })?.code === "P2002" ||
      (err instanceof Error && err.message.includes("P2002"));
    if (isUniqueViolation) {
      const winner = await db.ministry.findFirst({
        where: { churchId, name: { equals: name, mode: "insensitive" } },
        select: { id: true, name: true },
      });
      if (winner) {
        return NextResponse.json(winner);
      }
    }
    throw err;
  }
}
