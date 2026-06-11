import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { encrypt } from "@/lib/crypto/aes";
import type { SessionMembership } from "@/lib/auth/types";
import type { Role } from "@prisma/client";

interface StripeKeysBody {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
}

function isValidPublishableKey(key: string): boolean {
  return key.startsWith("pk_live_") || key.startsWith("pk_test_");
}

function isValidSecretKey(key: string): boolean {
  return key.startsWith("sk_live_") || key.startsWith("sk_test_");
}

function isValidWebhookSecret(key: string): boolean {
  return key.startsWith("whsec_");
}

export async function POST(req: NextRequest) {
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

  const canResult = await can("settings.payment", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles as Role[],
  });
  if (!canResult.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as StripeKeysBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { publishableKey, secretKey, webhookSecret } = body;

  if (!publishableKey || typeof publishableKey !== "string" || !publishableKey.trim()) {
    return NextResponse.json({ error: "Publishable key is required" }, { status: 400 });
  }
  if (!secretKey || typeof secretKey !== "string" || !secretKey.trim()) {
    return NextResponse.json({ error: "Secret key is required" }, { status: 400 });
  }
  if (!webhookSecret || typeof webhookSecret !== "string" || !webhookSecret.trim()) {
    return NextResponse.json({ error: "Webhook secret is required" }, { status: 400 });
  }

  const pk = publishableKey.trim();
  const sk = secretKey.trim();
  const ws = webhookSecret.trim();

  if (!isValidPublishableKey(pk)) {
    return NextResponse.json(
      { error: "Publishable key must start with pk_live_ or pk_test_" },
      { status: 422 },
    );
  }
  if (!isValidSecretKey(sk)) {
    return NextResponse.json(
      { error: "Secret key must start with sk_live_ or sk_test_" },
      { status: 422 },
    );
  }
  if (!isValidWebhookSecret(ws)) {
    return NextResponse.json(
      { error: "Webhook secret must start with whsec_" },
      { status: 422 },
    );
  }

  const isLive = sk.startsWith("sk_live_");
  const encryptedSecretKey = encrypt(sk);
  const encryptedWebhookSecret = encrypt(ws);

  await Promise.all([
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
        label: "Stripe Keys",
        encrypted: encryptedSecretKey,
        publishable: pk,
        isLive,
      },
      update: {
        encrypted: encryptedSecretKey,
        publishable: pk,
        rotatedAt: new Date(),
        deletedAt: null,
      },
      ...({ _bypassTenancyCheck: true } as object),
    }),
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
        encrypted: encryptedWebhookSecret,
        isLive: true,
      },
      update: {
        encrypted: encryptedWebhookSecret,
        rotatedAt: new Date(),
        deletedAt: null,
      },
      ...({ _bypassTenancyCheck: true } as object),
    }),
  ]);

  return NextResponse.json({ success: true });
}
