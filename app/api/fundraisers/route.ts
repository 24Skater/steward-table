import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const optionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  priceDelta: z.number().int(),
});

const modifierGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  isRequired: z.boolean().default(false),
  minSelections: z.number().int().min(0).default(0),
  maxSelections: z.number().int().min(1).default(1),
  options: z.array(optionSchema).min(1).max(30),
});

const itemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  price: z.number().int().min(0), // cents
  imageUrl: z.string().url().nullish(),
  modifierGroups: z.array(modifierGroupSchema).max(10).default([]),
});

const createFundraiserSchema = z.object({
  churchId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullish(),
  ministryId: z.string().nullish(),
  kitchenId: z.string().nullish(),
  opensAt: z.string().datetime().nullish(),
  closesAt: z.string().datetime().nullish(),
  minItemsForDelivery: z.number().int().min(1).max(1000).nullish(),
  items: z.array(itemSchema).min(1).max(100),
});

function buildSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") + `-${Date.now()}`
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createFundraiserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 422 },
    );
  }

  const {
    churchId,
    name,
    description,
    ministryId,
    kitchenId,
    opensAt,
    closesAt,
    minItemsForDelivery,
    items,
  } = parsed.data;

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

  if (ministryId) {
    const ministry = await db.ministry.findFirst({
      where: { id: ministryId, churchId },
      select: { id: true },
    });
    if (!ministry) {
      return NextResponse.json({ error: "Invalid ministry" }, { status: 422 });
    }
  }

  if (kitchenId) {
    const kitchen = await db.kitchen.findFirst({
      where: { id: kitchenId, churchId },
      select: { id: true },
    });
    if (!kitchen) {
      return NextResponse.json({ error: "Invalid kitchen" }, { status: 422 });
    }
  }

  const slug = buildSlug(name);

  const catalog = await db.$transaction(async (tx) => {
    const newCatalog = await tx.catalog.create({
      data: {
        churchId,
        name,
        slug,
        description: description ?? null,
        status: "DRAFT",
        opensAt: opensAt ? new Date(opensAt) : null,
        closesAt: closesAt ? new Date(closesAt) : null,
        kitchenId: kitchenId ?? null,
        ministryId: ministryId ?? null,
        minItemsForDelivery: minItemsForDelivery ?? null,
        createdById: session.user.id,
      },
      select: { id: true },
    });

    for (let index = 0; index < items.length; index++) {
      const itemData = items[index]!;

      const newItem = await tx.item.create({
        data: {
          churchId,
          name: itemData.name,
          defaultPrice: itemData.price,
          imageUrl: itemData.imageUrl ?? null,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      await tx.catalogItem.create({
        data: {
          catalogId: newCatalog.id,
          itemId: newItem.id,
          sortOrder: index,
        },
      });

      for (let groupIndex = 0; groupIndex < itemData.modifierGroups.length; groupIndex++) {
        const group = itemData.modifierGroups[groupIndex]!;

        const newGroup = await tx.modifierGroup.create({
          data: {
            churchId,
            name: group.name,
            defaultIsRequired: group.isRequired,
            defaultMinSelections: group.minSelections,
            defaultMaxSelections: group.maxSelections,
            options: {
              create: group.options.map((opt, optIndex) => ({
                name: opt.name,
                priceDelta: opt.priceDelta,
                sortOrder: optIndex,
              })),
            },
          },
          select: { id: true },
        });

        await tx.itemModifierGroup.create({
          data: {
            itemId: newItem.id,
            groupId: newGroup.id,
            sortOrder: groupIndex,
          },
        });
      }
    }

    return newCatalog;
  });

  return NextResponse.json({ catalogId: catalog.id }, { status: 201 });
}
