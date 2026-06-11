import { Resend } from "resend";
import { db } from "@/lib/db";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface OrderNotificationPayload {
  orderId: string;
  status: string;
  churchId: string;
  churchName: string;
  customerEmail: string;
  customerName: string;
  orderNumber: number;
  fulfillment: string;
  scheduledFor: Date | null;
}

interface NotificationMessage {
  subject: string;
  headline: string;
  body: string;
  template: string;
}

const NOTIFICATION_MESSAGES: Partial<Record<string, NotificationMessage>> = {
  CONFIRMED: {
    subject: "Your order has been confirmed",
    headline: "Order confirmed",
    body: "Your order has been received and is being prepared.",
    template: "order.confirmed",
  },
  READY: {
    subject: "Your order is ready for pickup",
    headline: "Your order is ready",
    body: "Your order is ready. Please come pick it up.",
    template: "order.ready",
  },
  AWAITING_PICKUP: {
    subject: "Your order is ready for pickup",
    headline: "Your order is ready",
    body: "Your order is ready and waiting for you.",
    template: "order.awaiting_pickup",
  },
  OUT_FOR_DELIVERY: {
    subject: "Your order is on its way",
    headline: "Your order is out for delivery",
    body: "Your order is on its way to you.",
    template: "order.out_for_delivery",
  },
  PICKED_UP: {
    subject: "Thanks for your order",
    headline: "Order complete",
    body: "Thank you for your order. We hope to see you again soon.",
    template: "order.picked_up",
  },
  DELIVERED: {
    subject: "Your order has been delivered",
    headline: "Order delivered",
    body: "Your order has been delivered. Thank you for ordering with us.",
    template: "order.delivered",
  },
  CANCELED: {
    subject: "Your order has been cancelled",
    headline: "Order cancelled",
    body: "Your order has been cancelled. If you have questions, please contact the church.",
    template: "order.canceled",
  },
};

export async function sendOrderNotification(
  orderId: string,
  status: string,
): Promise<void> {
  const message = NOTIFICATION_MESSAGES[status];
  if (!message || !resend) return;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { email: true, name: true } },
      church: { select: { id: true, name: true } },
    },
    // @ts-expect-error — bypass tenancy for notification reads
    _bypassTenancyCheck: true,
  });

  if (!order?.customer?.email) return;

  const payload: OrderNotificationPayload = {
    orderId: order.id,
    status,
    churchId: order.church.id,
    churchName: order.church.name,
    customerEmail: order.customer.email,
    customerName: order.customer.name,
    orderNumber: order.number,
    fulfillment: order.fulfillment,
    scheduledFor: order.scheduledFor,
  };

  const fromAddress =
    process.env.RESEND_FROM_EMAIL ?? "orders@table.steward.app";
  const subject = `${message.subject} — ${payload.churchName}`;

  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: payload.customerEmail,
      subject,
      html: buildEmailHtml(payload, message),
    });

    await db.emailLog.create({
      data: {
        churchId: payload.churchId,
        to: payload.customerEmail,
        from: fromAddress,
        subject,
        template: message.template,
        status: "sent",
        providerId: result.data?.id ?? null,
        metadata: { orderId, orderStatus: status },
      },
    });
  } catch {
    // Email sending is best-effort — never throw, never block order flow
  }
}

function buildEmailHtml(
  payload: OrderNotificationPayload,
  message: NotificationMessage,
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${message.headline}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #0f172a; padding: 24px; text-align: center;">
      <p style="color: #94a3b8; font-size: 13px; margin: 0;">${payload.churchName}</p>
    </div>
    <div style="padding: 32px 24px;">
      <h1 style="font-size: 22px; font-weight: 600; color: #0f172a; margin: 0 0 8px;">${message.headline}</h1>
      <p style="color: #64748b; font-size: 15px; margin: 0 0 24px;">Hi ${payload.customerName}, ${message.body}</p>
      <div style="background: #f1f5f9; border-radius: 8px; padding: 16px;">
        <p style="color: #475569; font-size: 13px; margin: 0 0 4px;">Order number</p>
        <p style="color: #0f172a; font-size: 20px; font-weight: 700; font-family: monospace; margin: 0;">#${payload.orderNumber}</p>
      </div>
    </div>
    <div style="padding: 16px 24px; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
        Powered by Steward Table
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
