import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createDefaultKitchen } from "@/lib/kitchens/defaults";

const SLUG_REGEX = /^[a-z0-9-]{3,50}$/;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, slug, timezone } = body as Record<string, unknown>;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  if (!SLUG_REGEX.test(slug)) {
    return NextResponse.json(
      { error: "Slug must be 3-50 lowercase letters, numbers, or hyphens" },
      { status: 400 },
    );
  }

  const resolvedTimezone =
    typeof timezone === "string" && timezone.trim().length > 0
      ? timezone.trim()
      : "America/Chicago";

  // Check slug uniqueness
  const existing = await (db.church.findUnique as Function)({
    where: { slug },
    select: { id: true },
    _bypassTenancyCheck: true,
  });

  if (existing) {
    return NextResponse.json({ error: "That URL is already taken" }, { status: 409 });
  }

  // Create church, settings, and OWNER membership atomically
  const church = await db.$transaction(async (tx) => {
    const newChurch = await (tx.church.create as Function)({
      data: {
        name: name.trim(),
        slug,
        timezone: resolvedTimezone,
      },
    });

    await (tx.churchSettings.create as Function)({
      data: { churchId: newChurch.id },
    });

    await (tx.membership.create as Function)({
      data: {
        userId: session.user.id,
        churchId: newChurch.id,
        roles: ["OWNER"],
        status: "ACTIVE",
      },
    });

    await createDefaultKitchen(tx as never, newChurch.id);

    return newChurch;
  });

  return NextResponse.json({ churchId: church.id, slug: church.slug }, { status: 201 });
}
