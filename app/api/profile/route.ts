import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(200).nullable().optional(),
  phone: z.string().min(1).max(50).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const raw: unknown = await req.json().catch(() => null);
  const parsed = UpdateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, phone } = parsed.data;

  const data: Record<string, string | null> = {};
  if (name !== undefined) data.name = name ?? null;
  if (phone !== undefined) data.phone = phone ?? null;

  await (db.user.update as Function)({
    where: { id: session.user.id },
    data,
    _bypassTenancyCheck: true,
  });

  return NextResponse.json({ success: true });
}
