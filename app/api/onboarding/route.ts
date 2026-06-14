import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { createDefaultKitchen } from "@/lib/kitchens/defaults";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const onboardingSchema = z.object({
  churchName: z.string().min(1, "Church name is required"),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      "Slug must start and end with a letter or number, and contain only lowercase letters, numbers, and hyphens",
    ),
  timezone: z.string().min(1),
  displayName: z.string().min(1, "Display name is required"),
  phone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // If user already has an active membership, return 409
  const hasActiveMembership = session.user.memberships?.some(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (hasActiveMembership) {
    return NextResponse.json({ error: "You already belong to a church." }, { status: 409 });
  }

  const rawBody: unknown = await req.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = onboardingSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return NextResponse.json({ error: firstError?.message ?? "Validation error" }, { status: 400 });
  }

  const { churchName, slug, timezone, displayName, phone } = parsed.data;

  // Check slug uniqueness
  const existingChurch = await (db.church.findUnique as PrismaBypass)({
    where: { slug },
    select: { id: true },
    ...({ _bypassTenancyCheck: true } as object),
  });

  if (existingChurch) {
    return NextResponse.json(
      { error: "That URL slug is already taken. Please choose another." },
      { status: 422 },
    );
  }

  await db.$transaction(async (tx) => {
    const church = await (tx.church.create as PrismaBypass)({
      data: {
        name: churchName,
        slug,
        timezone,
      },
    });

    await (tx.user.update as PrismaBypass)({
      where: { id: session.user.id },
      data: {
        name: displayName,
        ...(phone ? { phone } : {}),
      },
    });

    await (tx.membership.create as PrismaBypass)({
      data: {
        userId: session.user.id,
        churchId: church.id,
        roles: ["OWNER"],
        status: "ACTIVE",
      },
    });

    await (tx.churchSettings.create as PrismaBypass)({
      data: { churchId: church.id },
    });

    await (tx.orderCounter.create as PrismaBypass)({
      data: {
        churchId: church.id,
        value: 0,
      },
    });

    await createDefaultKitchen(tx as never, church.id);
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
