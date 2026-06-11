import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!membership) {
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

  // Build where clause with proper typing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    churchId,
  };

  if (since) {
    where.createdAt = { gte: since };
  }

  if (statusFilter) {
    where.status = statusFilter as OrderStatus;
  }

  const orders = await db.order.findMany({
    where,
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          itemName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10_000, // cap to avoid memory issues
  });

  // Build CSV
  const rows: string[] = [];

  // Header row
  rows.push(
    [
      "Order #",
      "Date",
      "Status",
      "Fulfillment",
      "Customer Name",
      "Customer Phone",
      "Customer Email",
      "Items",
      "Total (USD)",
      "Notes",
    ]
      .map(csvEscape)
      .join(","),
  );

  for (const order of orders) {
    const itemSummary = order.items.map((item) => `${item.quantity}x ${item.itemName}`).join("; ");

    // total is in cents
    const totalUsd = (order.total / 100).toFixed(2);

    const customerName = order.customer?.name ?? "";
    const customerPhone = order.customer?.phone ?? "";
    const customerEmail = order.customer?.email ?? "";

    rows.push(
      [
        order.number.toString(),
        order.createdAt.toISOString().slice(0, 19).replace("T", " "),
        order.status,
        order.fulfillment,
        customerName,
        customerPhone,
        customerEmail,
        itemSummary,
        totalUsd,
        order.notes ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const csv = rows.join("\r\n");
  const filename = `orders-${range}-${now.toISOString().slice(0, 10)}.csv`;

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
