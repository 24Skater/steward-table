import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { encrypt } from "@/lib/crypto/aes";
import type { SessionMembership } from "@/lib/auth/types";

export async function GET() {
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

  const result = await can("settings.payment", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [settings, stripeKey, webhookKey] = await Promise.all([
    (db.churchSettings.findUnique as Function)({
      where: { churchId: membership.churchId },
      select: { stripeMode: true },
      _bypassTenancyCheck: true,
    }),
    (db.apiKey.findFirst as Function)({
      where: { churchId: membership.churchId, provider: "stripe", isLive: true },
      select: { publishable: true },
      _bypassTenancyCheck: true,
    }),
    (db.apiKey.findFirst as Function)({
      where: { churchId: membership.churchId, provider: "stripe_webhook", isLive: true },
      select: { id: true },
      _bypassTenancyCheck: true,
    }),
  ]);

  return NextResponse.json({
    stripeMode: settings?.stripeMode ?? "BYO",
    hasStripeKey: !!stripeKey,
    hasWebhookSecret: !!webhookKey,
    stripeKeyHint: stripeKey?.publishable
      ? `${stripeKey.publishable.slice(0, 7)}****...****${stripeKey.publishable.slice(-4)}`
      : null,
  });
}

export async function PATCH(req: NextRequest) {
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

  const result = await can("settings.payment", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as {
    stripeSecretKey?: string;
    stripeWebhookSecret?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const ops: Promise<unknown>[] = [];

  if (body.stripeSecretKey && body.stripeSecretKey.trim()) {
    const trimmed = body.stripeSecretKey.trim();
    const encryptedKey = encrypt(trimmed);
    // Determine live vs test from key prefix
    const isLive = trimmed.startsWith("sk_live_");
    // Store the first 7 chars + last 4 as a hint in publishable field (non-secret hint)
    const hint = `${trimmed.slice(0, 7)}****${trimmed.slice(-4)}`;

    ops.push(
      (db.apiKey.upsert as Function)({
        where: {
          churchId_provider_isLive: {
            churchId: membership.churchId,
            provider: "stripe",
            isLive,
          },
        },
        create: {
          churchId: membership.churchId,
          provider: "stripe",
          label: "Stripe Secret Key",
          encrypted: encryptedKey,
          publishable: hint,
          isLive,
        },
        update: {
          encrypted: encryptedKey,
          publishable: hint,
          rotatedAt: new Date(),
          deletedAt: null,
        },
        _bypassTenancyCheck: true,
      }),
    );
  }

  if (body.stripeWebhookSecret && body.stripeWebhookSecret.trim()) {
    const trimmed = body.stripeWebhookSecret.trim();
    const encryptedWebhook = encrypt(trimmed);

    ops.push(
      (db.apiKey.upsert as Function)({
        where: {
          churchId_provider_isLive: {
            churchId: membership.churchId,
            provider: "stripe_webhook",
            isLive: true,
          },
        },
        create: {
          churchId: membership.churchId,
          provider: "stripe_webhook",
          label: "Stripe Webhook Secret",
          encrypted: encryptedWebhook,
          isLive: true,
        },
        update: {
          encrypted: encryptedWebhook,
          rotatedAt: new Date(),
          deletedAt: null,
        },
        _bypassTenancyCheck: true,
      }),
    );
  }

  await Promise.all(ops);

  return NextResponse.json({
    stripeMode: "BYO",
    hasStripeKey: !!body.stripeSecretKey,
    hasWebhookSecret: !!body.stripeWebhookSecret,
  });
}
