import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { CATALOG_TEMPLATE_MAP } from "@/lib/catalog-templates";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    catalogName?: string;
    templateKey?: string;
    churchId?: string;
  } | null;

  if (!body?.catalogName || !body?.templateKey || !body?.churchId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const template = CATALOG_TEMPLATE_MAP[body.templateKey];
  if (!template) {
    return NextResponse.json({ error: "Unknown template key" }, { status: 400 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.churchId === body.churchId && m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("catalog.edit", {
    userId: session.user.id,
    churchId: body.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const baseSlug = body.catalogName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Ensure slug uniqueness within the church by appending a timestamp suffix.
  const slug = `${baseSlug}-${Date.now()}`;

  const catalog = await db.$transaction(async (tx) => {
    const newCatalog = await tx.catalog.create({
      data: {
        name: body.catalogName as string,
        slug,
        churchId: body.churchId as string,
        status: "DRAFT",
      },
    });

    // Build a name → groupId map so items can reference modifier groups.
    const groupIdByName = new Map<string, string>();

    for (const group of template.modifierGroups) {
      const newGroup = await tx.modifierGroup.create({
        data: {
          churchId: body.churchId as string,
          name: group.name,
          translations: { es: { name: group.nameEs } },
          defaultMinSelections: group.minSelections,
          defaultMaxSelections: group.maxSelections,
          defaultIsRequired: group.isRequired,
          options: {
            create: group.options.map((opt, idx) => ({
              name: opt.name,
              translations: { es: { name: opt.nameEs } },
              priceDelta: opt.priceDelta,
              isDefault: opt.isDefault,
              sortOrder: idx,
            })),
          },
        },
      });
      groupIdByName.set(group.name, newGroup.id);
    }

    let itemIdx = 0;
    for (const templateItem of template.items) {
      const newItem = await tx.item.create({
        data: {
          churchId: body.churchId as string,
          name: templateItem.name,
          translations: {
            es: {
              name: templateItem.nameEs,
              ...(templateItem.descriptionEs ? { description: templateItem.descriptionEs } : {}),
            },
          },
          description: templateItem.description ?? null,
          defaultPrice: templateItem.defaultPrice,
          status: "ACTIVE",
          station: templateItem.station ?? null,
        },
      });

      // Link item to catalog.
      await tx.catalogItem.create({
        data: {
          catalogId: newCatalog.id,
          itemId: newItem.id,
          sortOrder: itemIdx,
        },
      });

      // Bind modifier groups to item.
      let groupIdx = 0;
      for (const groupName of templateItem.modifierGroupNames) {
        const groupId = groupIdByName.get(groupName);
        if (groupId) {
          await tx.itemModifierGroup.create({
            data: {
              itemId: newItem.id,
              groupId,
              sortOrder: groupIdx,
            },
          });
          groupIdx++;
        }
      }

      itemIdx++;
    }

    return newCatalog;
  });

  return NextResponse.json({ catalogId: catalog.id }, { status: 201 });
}
