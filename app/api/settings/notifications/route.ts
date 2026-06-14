import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";

interface NotificationSettingsBody {
  emailConfirmationEnabled: boolean;
  emailStatusEnabled: boolean;
  emailStaffOnNewOrder: boolean;
  smsEnabled: boolean;
  smsConfirmationEnabled: boolean;
  smsReadyEnabled: boolean;
}

function isNotificationSettingsBody(body: unknown): body is NotificationSettingsBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.emailConfirmationEnabled === "boolean" &&
    typeof b.emailStatusEnabled === "boolean" &&
    typeof b.emailStaffOnNewOrder === "boolean" &&
    typeof b.smsEnabled === "boolean" &&
    typeof b.smsConfirmationEnabled === "boolean" &&
    typeof b.smsReadyEnabled === "boolean"
  );
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canResult = await can("church.update", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!canResult.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawBody = await req.json().catch(() => null);
  if (!isNotificationSettingsBody(rawBody)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    emailConfirmationEnabled,
    emailStatusEnabled,
    emailStaffOnNewOrder,
    smsEnabled,
    smsConfirmationEnabled,
    smsReadyEnabled,
  } = rawBody;

  // Fetch existing brandTokens to merge — avoid clobbering unrelated keys
  const existing = await (db.churchSettings.findUnique as PrismaBypass)({
    where: { churchId: membership.churchId },
    select: { brandTokens: true },
    ...({ _bypassTenancyCheck: true } as object),
  }) as { brandTokens: unknown } | null;

  const existingTokens =
    existing?.brandTokens && typeof existing.brandTokens === "object"
      ? (existing.brandTokens as Record<string, unknown>)
      : {};

  const updatedBrandTokens = {
    ...existingTokens,
    emailConfirmationEnabled,
    emailStatusEnabled,
    emailStaffOnNewOrder,
    smsConfirmationEnabled,
    smsReadyEnabled,
  };

  await (db.churchSettings.upsert as PrismaBypass)({
    where: { churchId: membership.churchId },
    create: {
      churchId: membership.churchId,
      smsEnabled,
      brandTokens: updatedBrandTokens,
    },
    update: {
      smsEnabled,
      brandTokens: updatedBrandTokens,
    },
    ...({ _bypassTenancyCheck: true } as object),
  });

  return NextResponse.json({ success: true });
}
