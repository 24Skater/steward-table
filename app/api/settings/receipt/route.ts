import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

const schema = z.object({
  receiptLanguage: z.enum(["OFF", "US_501C3", "CUSTOM"]),
  receiptCustomFooter: z.string().max(1000).nullable().optional(),
  ein: z.string().max(20).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const membership = session.user.memberships?.find((m) => m.status === "ACTIVE");
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { churchId, roles } = membership;

  const permission = await can("settings.receipt", {
    userId: session.user.id,
    churchId,
    roles,
  });
  if (!permission.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { receiptLanguage, receiptCustomFooter, ein } = body;

  await Promise.all([
    db.churchSettings.update({
      where: { churchId },
      data: {
        receiptLanguage,
        receiptCustomFooter: receiptLanguage === "CUSTOM" ? (receiptCustomFooter ?? null) : null,
        receiptLanguageVersion: { increment: 1 },
      },
    }),
    ein !== undefined
      ? (db.church.update as PrismaBypass)({
          where: { id: churchId },
          data: { ein: ein ?? null },
          _bypassTenancyCheck: true,
        })
      : Promise.resolve(),
  ]);

  return NextResponse.json({ success: true });
}
