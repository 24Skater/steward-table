import Twilio from "twilio";
import { db } from "@/lib/db";

// Lazy client — only instantiated when all three env vars are present
function getTwilioClient(): Twilio.Twilio | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return Twilio(accountSid, authToken);
}

export interface SmsResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

export async function sendSms(
  to: string,
  body: string,
  churchId: string,
): Promise<SmsResult> {
  const client = getTwilioClient();
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!client || !fromNumber) {
    await db.smsLog.create({
      data: { churchId, to, body, status: "skipped" },
    });
    return { success: false, error: "SMS not configured" };
  }

  try {
    const message = await client.messages.create({
      to,
      from: fromNumber,
      body,
    });

    await db.smsLog.create({
      data: {
        churchId,
        to,
        body,
        status: "sent",
        providerId: message.sid,
      },
    });

    return { success: true, messageSid: message.sid };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error";

    await db.smsLog.create({
      data: {
        churchId,
        to,
        body,
        status: "failed",
        metadata: { error: errorMessage },
      },
    });

    return { success: false, error: errorMessage };
  }
}

// ── Template helpers ──────────────────────────────────────────────────────────

export function smsOrderConfirmation(
  orderNumber: number,
  churchName: string,
): string {
  return `Your order #${orderNumber} has been received at ${churchName}. We'll notify you when it's ready!`;
}

export function smsOrderReady(
  orderNumber: number,
  fulfillment: "PICKUP" | "DELIVERY",
): string {
  if (fulfillment === "DELIVERY") {
    return `Your order #${orderNumber} is on its way!`;
  }
  return `Your order #${orderNumber} is ready for pickup!`;
}

export function smsOutForDelivery(orderNumber: number): string {
  return `Your order #${orderNumber} is out for delivery!`;
}
