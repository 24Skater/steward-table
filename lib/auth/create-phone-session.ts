import crypto from "crypto";
import { db } from "@/lib/db";

const SESSION_DAYS = 30;
const LINK_EXPIRY_HOURS = 1;

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createMagicLinkToken(
  phone: string,
): Promise<{ token: string; url: string }> {
  const token = generateSecureToken();
  const expires = new Date(Date.now() + LINK_EXPIRY_HOURS * 60 * 60 * 1000);

  // Delete any existing token for this phone to avoid stale tokens
  await (db.verificationToken.deleteMany as PrismaBypass)({
    where: { identifier: phone },
    _bypassTenancyCheck: true,
  }).catch(() => null);

  await (db.verificationToken.create as PrismaBypass)({
    data: { identifier: phone, token, expires },
    _bypassTenancyCheck: true,
  });

  return { token, url: "" };
}

export async function verifyMagicLinkToken(
  token: string,
  phone: string,
): Promise<boolean> {
  const record = await (db.verificationToken.findUnique as PrismaBypass)({
    where: { token },
    _bypassTenancyCheck: true,
  }) as { identifier: string; token: string; expires: Date } | null;

  if (!record) return false;
  if (record.identifier !== phone) return false;
  if (record.expires < new Date()) {
    await (db.verificationToken.delete as PrismaBypass)({
      where: { token },
      _bypassTenancyCheck: true,
    }).catch(() => null);
    return false;
  }

  // Consume the token
  await (db.verificationToken.delete as PrismaBypass)({
    where: { token },
    _bypassTenancyCheck: true,
  }).catch(() => null);

  return true;
}

export async function findOrCreateUserByPhone(phone: string): Promise<string> {
  const existing = await (db.user.findUnique as PrismaBypass)({
    where: { phone },
    select: { id: true },
    _bypassTenancyCheck: true,
  }) as { id: string } | null;

  if (existing) return existing.id;

  const user = await (db.user.create as PrismaBypass)({
    data: { phone, phoneVerified: new Date() },
    select: { id: true },
    _bypassTenancyCheck: true,
  }) as { id: string };

  return user.id;
}

export async function linkCustomerToUser(
  customerId: string,
  userId: string,
): Promise<void> {
  await db.customer.update({
    where: { id: customerId },
    data: { userId },
  });
}

export async function createDatabaseSession(userId: string): Promise<string> {
  const sessionToken = generateSecureToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await (db.session.create as PrismaBypass)({
    data: { sessionToken, userId, expires },
    _bypassTenancyCheck: true,
  });

  return sessionToken;
}
