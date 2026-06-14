import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac/can";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { churchId, roles } = membership;

  const permission = await can("customer.edit", {
    userId: session.user.id,
    churchId,
    roles,
  });
  if (!permission.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { customerId } = await params;

  // Verify the customer belongs to this church
  const existing = await (db.customer.findFirst as PrismaBypass)({
    where: { id: customerId, churchId, deletedAt: null },
    _bypassTenancyCheck: true,
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;

  const updateData: Record<string, unknown> = {};

  if ("name" in input && typeof input.name === "string" && input.name.trim()) {
    updateData.name = input.name.trim();
  }
  if ("email" in input) {
    updateData.email = typeof input.email === "string" ? input.email.trim() || null : null;
    if (updateData.email) {
      updateData.emailNormalized = (updateData.email as string).toLowerCase();
    } else {
      updateData.emailNormalized = null;
    }
  }
  if ("phone" in input) {
    updateData.phone = typeof input.phone === "string" ? input.phone.trim() || null : null;
    if (updateData.phone) {
      updateData.phoneNormalized = (updateData.phone as string).replace(/\D/g, "");
    } else {
      updateData.phoneNormalized = null;
    }
  }
  if ("notes" in input) {
    updateData.notes = typeof input.notes === "string" ? input.notes.trim() || null : null;
  }
  if ("smsOptIn" in input && typeof input.smsOptIn === "boolean") {
    updateData.smsOptIn = input.smsOptIn;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const updated = await db.customer.update({
      where: { id: customerId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        notes: true,
        smsOptIn: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.toLowerCase().includes("unique constraint")
    ) {
      return NextResponse.json(
        { error: "A customer with that email or phone already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
