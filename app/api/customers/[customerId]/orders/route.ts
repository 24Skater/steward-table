import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { customerId } = await params;

  const membership = (
    session.user as {
      memberships?: Array<{ churchId: string; status: string }>;
    }
  ).memberships?.find((m) => m.status === "ACTIVE");

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { churchId } = membership;

  // Verify customer belongs to this church (tenancy safety check)
  const customer = await (db.customer.findFirst as Function)({
    where: { id: customerId, churchId, deletedAt: null },
    _bypassTenancyCheck: true,
  });

  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const orders = await db.order.findMany({
    where: { customerId, churchId },
    select: {
      id: true,
      number: true,
      status: true,
      fulfillment: true,
      createdAt: true,
      total: true,
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(orders);
}
