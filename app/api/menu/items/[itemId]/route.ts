import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";

const translationsSchema = z
  .object({
    es: z
      .object({
        name: z.string().max(200).optional(),
        description: z.string().max(1000).optional(),
      })
      .optional(),
  })
  .optional();

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  defaultPrice: z.number().int().min(0).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  imageUrl: z.string().url().nullable().optional(),
  translations: translationsSchema,
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
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

  const canResult = await can("catalog.edit", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!canResult.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { itemId } = await params;

  // Verify item belongs to this church
  const existing = await db.item.findFirst({
    where: { id: itemId, churchId: membership.churchId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const rawBody = await req.json().catch(() => null);
  if (!rawBody) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 },
    );
  }

  const { name, description, defaultPrice, status, imageUrl, translations } = parsed.data;

  const updated = await db.item.update({
    where: { id: itemId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(defaultPrice !== undefined && { defaultPrice }),
      ...(status !== undefined && { status }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(translations !== undefined && {
        translations: translations as Prisma.InputJsonValue,
      }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      defaultPrice: true,
      imageUrl: true,
      status: true,
    },
  });

  return NextResponse.json({ success: true, item: updated });
}
