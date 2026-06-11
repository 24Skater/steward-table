import Stripe from "stripe";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto/aes";

export async function getStripeForChurch(churchId: string): Promise<Stripe | null> {
  const apiKey = await (db.apiKey.findFirst as Function)({
    where: { churchId, provider: "stripe", deletedAt: null },
    select: { encrypted: true, isLive: true },
    _bypassTenancyCheck: true,
  });

  if (!apiKey?.encrypted) {
    return null;
  }

  const secretKey = decrypt(Buffer.from(apiKey.encrypted as Uint8Array));

  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" });
}

export async function getStripeWebhookSecret(churchId: string): Promise<string | null> {
  const apiKey = await (db.apiKey.findFirst as Function)({
    where: { churchId, provider: "stripe_webhook", deletedAt: null },
    select: { encrypted: true },
    _bypassTenancyCheck: true,
  });

  if (!apiKey?.encrypted) {
    return null;
  }

  return decrypt(Buffer.from(apiKey.encrypted as Uint8Array));
}
