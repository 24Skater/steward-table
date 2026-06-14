import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { NextRequest } from "next/server";

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!membership) {
    return new Response("Forbidden", { status: 403 });
  }

  const { churchId, roles } = membership;

  const permission = await can("customer.export", {
    userId: session.user.id,
    churchId,
    roles,
  });
  if (!permission.allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

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

  const customers = await db.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50_000,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      totalOrders: true,
      lifetimeValueCents: true,
      smsOptIn: true,
      createdAt: true,
      orders: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Audit log this export
  try {
    await (db.auditLog.create as PrismaBypass)({
      data: {
        churchId,
        actorId: session.user.id,
        action: "customer.export",
        resource: "Customer",
        resourceId: null,
        metadata: { count: customers.length, query: q || null },
      },
    });
  } catch {
    // Non-fatal — don't block the export
  }

  const header = [
    "ID",
    "Name",
    "Phone",
    "Email",
    "Total Orders",
    "Lifetime Value (USD)",
    "SMS Opt-In",
    "Last Order At",
    "Created At",
  ].join(",");

  const rows = customers.map((c) => {
    const lastOrderAt = c.orders[0]?.createdAt ? new Date(c.orders[0].createdAt).toISOString() : "";
    return [
      escapeCsv(c.id),
      escapeCsv(c.name),
      escapeCsv(c.phone),
      escapeCsv(c.email),
      escapeCsv(c.totalOrders),
      escapeCsv((c.lifetimeValueCents / 100).toFixed(2)),
      escapeCsv(c.smsOptIn ? "Yes" : "No"),
      escapeCsv(lastOrderAt),
      escapeCsv(new Date(c.createdAt).toISOString()),
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const filename = `customers-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
