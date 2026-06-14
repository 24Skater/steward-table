import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const raw: unknown = await req.json().catch(() => null);
  const parsed = ChangePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const user = await (db.user.findUnique as PrismaBypass)({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true },
    _bypassTenancyCheck: true,
  }) as { id: string; passwordHash: string | null } | null;

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.passwordHash) {
    return NextResponse.json(
      { error: "Password change is not available for accounts signed in with a provider." },
      { status: 400 },
    );
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);

  await (db.user.update as PrismaBypass)({
    where: { id: session.user.id },
    data: { passwordHash: newHash },
    _bypassTenancyCheck: true,
  });

  return NextResponse.json({ success: true });
}
