import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

type BulkAction =
  | { action: "set_status"; value: "ACTIVE" | "INACTIVE"; itemIds: string[] }
  | { action: "set_price"; mode: "fixed" | "percent"; value: number; itemIds: string[] }
  | { action: "set_tax_category"; taxCategory: string | null; itemIds: string[] }
  | { action: "archive"; itemIds: string[] };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "No active membership" }, { status: 403 });
  }

  const perm = await can("catalog.edit", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!perm.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as BulkAction | null;
  if (!body?.action || !Array.isArray(body.itemIds) || body.itemIds.length === 0) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { itemIds } = body;
  const where = { churchId: membership.churchId, id: { in: itemIds } };

  switch (body.action) {
    case "set_status": {
      if (body.value !== "ACTIVE" && body.value !== "INACTIVE") {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
      await db.item.updateMany({ where, data: { status: body.value } });
      return NextResponse.json({ updated: itemIds.length });
    }

    case "set_price": {
      if (typeof body.value !== "number") {
        return NextResponse.json({ error: "Missing price value" }, { status: 400 });
      }
      if (body.mode === "fixed") {
        const cents = Math.round(body.value * 100);
        if (cents < 0) return NextResponse.json({ error: "Price must be >= 0" }, { status: 400 });
        await db.item.updateMany({ where, data: { defaultPrice: cents } });
      } else {
        // Percent adjustment — must fetch each item and apply individually
        const items = await db.item.findMany({
          where,
          select: { id: true, defaultPrice: true },
        });
        await db.$transaction(
          items.map((item) => {
            const adjusted = Math.max(0, Math.round(item.defaultPrice * (1 + body.value / 100)));
            return db.item.update({
              where: { id: item.id },
              data: { defaultPrice: adjusted },
            });
          }),
        );
      }
      return NextResponse.json({ updated: itemIds.length });
    }

    case "set_tax_category": {
      await db.item.updateMany({
        where,
        data: { taxCategory: body.taxCategory ?? null },
      });
      return NextResponse.json({ updated: itemIds.length });
    }

    case "archive": {
      await db.item.updateMany({
        where,
        data: { deletedAt: new Date() },
      });
      return NextResponse.json({ updated: itemIds.length });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
