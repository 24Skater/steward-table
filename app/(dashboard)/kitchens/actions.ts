"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/helpers";
import { can } from "@/lib/rbac/can";
import { db } from "@/lib/db";
import { generateUniqueKitchenSlug } from "@/lib/kitchens/slug";

async function requireCatalogEdit() {
  const session = await requireAuth();
  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!membership) throw new Error("No active membership");
  const result = await can("catalog.edit", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) throw new Error(result.reason ?? "Forbidden");
  return membership.churchId;
}

export async function createKitchen(name: string): Promise<void> {
  const churchId = await requireCatalogEdit();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Kitchen name is required");

  const existing = await db.kitchen.findMany({
    where: { churchId },
    select: { slug: true },
  });
  const slug = generateUniqueKitchenSlug(
    trimmed,
    existing.map((k) => k.slug),
  );

  await db.kitchen.create({ data: { churchId, name: trimmed, slug } });
  revalidatePath("/kitchens");
}

export async function renameKitchen(kitchenId: string, name: string): Promise<void> {
  const churchId = await requireCatalogEdit();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Kitchen name is required");

  await db.kitchen.updateMany({
    where: { id: kitchenId, churchId },
    data: { name: trimmed },
  });
  revalidatePath("/kitchens");
}

export async function setDefaultKitchen(kitchenId: string): Promise<void> {
  const churchId = await requireCatalogEdit();
  await db.$transaction(async (tx) => {
    await (tx.kitchen.updateMany as Function)({
      where: { churchId, isDefault: true },
      data: { isDefault: false },
    });
    await (tx.kitchen.updateMany as Function)({
      where: { id: kitchenId, churchId },
      data: { isDefault: true },
    });
  });
  revalidatePath("/kitchens");
}

export async function archiveKitchen(kitchenId: string): Promise<void> {
  const churchId = await requireCatalogEdit();

  const kitchen = await db.kitchen.findFirst({
    where: { id: kitchenId, churchId },
    select: { id: true, isDefault: true },
  });
  if (!kitchen) throw new Error("Kitchen not found");
  if (kitchen.isDefault) throw new Error("The default kitchen cannot be archived");

  const defaultKitchen = await db.kitchen.findFirst({
    where: { churchId, isDefault: true },
    select: { id: true },
  });
  if (!defaultKitchen) throw new Error("No default kitchen to reassign catalogs to");

  await db.$transaction(async (tx) => {
    await (tx.catalog.updateMany as Function)({
      where: { churchId, kitchenId: kitchen.id },
      data: { kitchenId: defaultKitchen.id },
    });
    await (tx.kitchen.updateMany as Function)({
      where: { id: kitchen.id, churchId },
      data: { deletedAt: new Date() },
    });
  });
  revalidatePath("/kitchens");
}
