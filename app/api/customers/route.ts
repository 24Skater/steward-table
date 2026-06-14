import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { type NextRequest, NextResponse } from "next/server";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

// ── GET /api/customers ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // 2. Active membership check
  const activeMembership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!activeMembership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { churchId, roles } = activeMembership;

  // 3. Permission check — any role that can read customers
  const permission = await can("customer.read", {
    userId: session.user.id,
    churchId,
    roles,
  });
  if (!permission.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Parse query params
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const rawPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const page = rawPage > 0 ? rawPage : 1;
  const limit = rawLimit > 0 && rawLimit <= MAX_LIMIT ? rawLimit : DEFAULT_LIMIT;

  // 5. Build where clause
  const where = {
    churchId,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  // 6. Fetch customers + total in parallel
  const [customers, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        totalOrders: true,
        lifetimeValueCents: true,
        createdAt: true,
        orders: {
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    db.customer.count({ where }),
  ]);

  const rows = customers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    totalOrders: c.totalOrders,
    lifetimeValueCents: c.lifetimeValueCents,
    createdAt: c.createdAt,
    lastOrderAt: c.orders[0]?.createdAt ?? null,
  }));

  return NextResponse.json({ customers: rows, total, page, limit });
}
