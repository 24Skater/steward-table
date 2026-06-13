import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";
import type { OrderStatus, Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) {
    return new Response("Forbidden", { status: 403 });
  }

  const rbac = await can("report.read", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!rbac.allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const { churchId } = membership;
  const range = req.nextUrl.searchParams.get("range") ?? "month";
  const statusFilter = req.nextUrl.searchParams.get("status");

  // Date range calculation
  const now = new Date();
  let since: Date | undefined;
  switch (range) {
    case "today":
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      since = new Date(now);
      since.setDate(now.getDate() - 7);
      break;
    case "month":
      since = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    // "all" — no date filter
  }

  const where: Prisma.OrderWhereInput = {
    churchId,
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(statusFilter ? { status: statusFilter as OrderStatus } : {}),
  };

  const orders = await db.order.findMany({
    where,
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      items: {
        select: {
          quantity: true,
          itemName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10_000, // cap to avoid memory issues
  });

  // Build CSV
  const rows: string[] = [];

  // Header row — columns match the export spec
  rows.push(
    ["Order #", "Status", "Customer Name", "Customer Email", "Customer Phone", "Fulfillment", "Items", "Total ($)", "Created At", "Scheduled For"]
      .map(csvEscape)
      .join(","),
  );

  for (const order of orders) {
    const itemSummary = order.items.map((item) => `${item.quantity}x ${item.itemName}`).join("; ");

    // total is stored in cents
    const totalUsd = (order.total / 100).toFixed(2);

    rows.push(
      [
        order.number.toString(),
        order.status,
        order.customer?.name ?? "",
        order.customer?.email ?? "",
        order.customer?.phone ?? "",
        order.fulfillment,
        itemSummary,
        totalUsd,
        order.createdAt.toISOString().slice(0, 19).replace("T", " "),
        order.scheduledFor ? order.scheduledFor.toISOString().slice(0, 19).replace("T", " ") : "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const csv = rows.join("\r\n");
  const filename = `orders-${now.toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
