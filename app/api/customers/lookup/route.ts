import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac/can";
import { db } from "@/lib/db";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { churchId, roles } = membership;

  const permission = await can("customer.read", {
    userId: session.user.id,
    churchId,
    roles,
  });
  if (!permission.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const phone = req.nextUrl.searchParams.get("phone")?.replace(/\D/g, "") ?? "";
  if (phone.length < 7) {
    return NextResponse.json({ customer: null });
  }

  const customer = await db.customer.findFirst({
    where: { churchId, phoneNormalized: phone },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      totalOrders: true,
    },
  });

  return NextResponse.json({ customer: customer ?? null });
}
