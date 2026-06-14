import { db } from "@/lib/db";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface OrderItemDetail {
  itemName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface OrderNotificationPayload {
  orderId: string;
  status: string;
  churchId: string;
  churchSlug: string;
  churchName: string;
  customerEmail: string;
  customerName: string;
  orderNumber: number;
  fulfillment: string;
  scheduledFor: Date | null;
  total: number;
  items: OrderItemDetail[];
  replyToEmail: string | null;
}

interface NotificationMessage {
  subject: string;
  headline: string;
  body: string;
  template: string;
}

const NOTIFICATION_MESSAGES: Partial<Record<string, NotificationMessage>> = {
  SUBMITTED: {
    subject: "Order received",
    headline: "Order received",
    body: "Thanks for your order! We have received it and will begin preparing it shortly.",
    template: "order.submitted",
  },
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

export async function sendOrderNotification(orderId: string, status: string): Promise<void> {
  const message = NOTIFICATION_MESSAGES[status];
  if (!message || !resend) return;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { email: true, name: true } },
      church: {
        select: {
          id: true,
          slug: true,
          name: true,
          settings: { select: { replyToEmail: true, brandTokens: true } },
        },
      },
      items: {
        select: { itemName: true, quantity: true, unitPrice: true, subtotal: true },
      },
    },
    // @ts-expect-error — bypass tenancy for notification reads
    _bypassTenancyCheck: true,
  });

  if (!order?.customer?.email) return;

  // Check church notification preferences before sending
  const tokens = order.church.settings?.brandTokens;
  const prefs = tokens && typeof tokens === "object" ? (tokens as Record<string, unknown>) : {};
  const isConfirmation = status === "SUBMITTED";
  const prefKey = isConfirmation ? "emailConfirmationEnabled" : "emailStatusEnabled";
  const prefEnabled = prefKey in prefs ? prefs[prefKey] !== false : true;
  if (!prefEnabled) return;

  const payload: OrderNotificationPayload = {
    orderId: order.id,
    status,
    churchId: order.church.id,
    churchSlug: order.church.slug,
    churchName: order.church.name,
    customerEmail: order.customer.email,
    customerName: order.customer.name,
    orderNumber: order.number,
    fulfillment: order.fulfillment,
    scheduledFor: order.scheduledFor,
    total: order.total,
    items: order.items,
    replyToEmail: order.church.settings?.replyToEmail ?? null,
  };

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "orders@table.steward.app";
  const subject = `${message.subject} — ${payload.churchName}`;

  const sendOptions: Parameters<typeof resend.emails.send>[0] = {
    from: fromAddress,
    to: payload.customerEmail,
    subject,
    html: buildEmailHtml(payload, message),
  };
  if (payload.replyToEmail) {
    sendOptions.replyTo = payload.replyToEmail;
  }

  try {
    const result = await resend.emails.send(sendOptions);

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

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function buildItemsTable(items: OrderItemDetail[]): string {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px 0; color: #334155; font-size: 14px;">${item.quantity}x ${item.itemName}</td>
          <td style="padding: 8px 0; color: #334155; font-size: 14px; text-align: right;">${formatCents(item.subtotal)}</td>
        </tr>`,
    )
    .join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 16px;">
      <thead>
        <tr>
          <th style="padding: 0 0 8px; color: #94a3b8; font-size: 12px; font-weight: 600; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Item</th>
          <th style="padding: 0 0 8px; color: #94a3b8; font-size: 12px; font-weight: 600; text-align: right; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}

function buildOrderCta(payload: OrderNotificationPayload): string {
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://table.steward.app";
  const orderUrl = `${baseUrl}/${payload.churchSlug}/order/${payload.orderId}`;
  return `
    <div style="text-align: center; margin-top: 20px;">
      <a href="${orderUrl}" style="display: inline-block; background: #059669; color: #ffffff; font-size: 14px; font-weight: 600; padding: 10px 24px; border-radius: 8px; text-decoration: none;">
        View order status
      </a>
    </div>`;
}

function buildConfirmedBody(payload: OrderNotificationPayload): string {
  const itemsTable = buildItemsTable(payload.items);
  const total = formatCents(payload.total);

  return `
    <p style="color: #64748b; font-size: 15px; margin: 0 0 4px;">Hi ${payload.customerName},</p>
    <p style="color: #64748b; font-size: 15px; margin: 0 0 24px;">Your order from <strong>${payload.churchName}</strong> has been confirmed.</p>
    <div style="background: #f1f5f9; border-radius: 8px; padding: 16px 20px;">
      <p style="color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin: 0 0 4px;">Order #${payload.orderNumber}</p>
      ${itemsTable}
      <div style="display: flex; justify-content: space-between; margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        <span style="color: #0f172a; font-size: 15px; font-weight: 700;">Total</span>
        <span style="color: #0f172a; font-size: 15px; font-weight: 700;">${total}</span>
      </div>
      ${buildFulfillmentLine(payload)}
    </div>
    ${buildOrderCta(payload)}`;
}

function buildFulfillmentLine(payload: OrderNotificationPayload): string {
  const label =
    payload.fulfillment === "DELIVERY"
      ? "Delivery"
      : payload.fulfillment === "DINE_IN"
        ? "Dine-in"
        : "Pickup";

  const scheduledLine = payload.scheduledFor
    ? `<br><span style="color: #64748b;">
        Scheduled: ${new Date(payload.scheduledFor).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </span>`
    : "";

  return `<p style="color: #64748b; font-size: 13px; margin: 12px 0 0;">${label}${scheduledLine}</p>`;
}

function buildSimpleBody(payload: OrderNotificationPayload, message: NotificationMessage): string {
  const itemsTable = buildItemsTable(payload.items);
  const total = formatCents(payload.total);

  return `
    <p style="color: #64748b; font-size: 15px; margin: 0 0 4px;">Hi ${payload.customerName},</p>
    <p style="color: #64748b; font-size: 15px; margin: 0 0 24px;">${message.body}</p>
    <div style="background: #f1f5f9; border-radius: 8px; padding: 16px 20px;">
      <p style="color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin: 0 0 4px;">Order #${payload.orderNumber}</p>
      ${itemsTable}
      <div style="display: flex; justify-content: space-between; margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        <span style="color: #0f172a; font-size: 15px; font-weight: 700;">Total</span>
        <span style="color: #0f172a; font-size: 15px; font-weight: 700;">${total}</span>
      </div>
      ${buildFulfillmentLine(payload)}
    </div>
    ${buildOrderCta(payload)}`;
}

export async function sendStaffNewOrderEmail(orderId: string): Promise<void> {
  if (!resend) return;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { name: true, phone: true } },
      church: {
        select: {
          id: true,
          name: true,
          settings: {
            select: {
              replyToEmail: true,
              brandTokens: true,
            },
          },
        },
      },
      items: { select: { itemName: true, quantity: true } },
    },
    // @ts-expect-error — bypass tenancy for notification reads
    _bypassTenancyCheck: true,
  });

  if (!order) return;

  const tokens = order.church.settings?.brandTokens;
  const staffNotifyEnabled =
    tokens &&
    typeof tokens === "object" &&
    (tokens as Record<string, unknown>).emailStaffOnNewOrder === true;
  if (!staffNotifyEnabled) return;

  const staffMembers = await db.membership.findMany({
    where: {
      churchId: order.church.id,
      status: "ACTIVE",
      roles: { hasSome: ["OWNER", "ADMIN", "STAFF"] },
    },
    include: {
      user: { select: { email: true, name: true } },
    },
  });

  const staffEmails = staffMembers
    .map((m) => m.user.email)
    .filter((e): e is string => typeof e === "string" && e.length > 0);

  if (staffEmails.length === 0) return;

  const itemList = order.items.map((i) => `${i.quantity}× ${i.itemName}`).join(", ");
  const subject = `New order #${order.number} — ${order.church.name}`;
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "orders@table.steward.app";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #0f172a; padding: 24px; text-align: center;">
      <p style="color: #94a3b8; font-size: 13px; margin: 0;">${order.church.name}</p>
    </div>
    <div style="padding: 32px 24px;">
      <h1 style="font-size: 22px; font-weight: 600; color: #0f172a; margin: 0 0 16px;">New order received</h1>
      <div style="background: #f1f5f9; border-radius: 8px; padding: 16px 20px;">
        <p style="color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin: 0 0 8px;">Order #${order.number}</p>
        <p style="color: #0f172a; font-size: 14px; margin: 0 0 4px;"><strong>Customer:</strong> ${order.customer.name}${order.customer.phone ? ` · ${order.customer.phone}` : ""}</p>
        <p style="color: #0f172a; font-size: 14px; margin: 0;"><strong>Items:</strong> ${itemList}</p>
      </div>
    </div>
    <div style="padding: 16px 24px; border-top: 1px solid #e2e8f0;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">Powered by Steward Table</p>
    </div>
  </div>
</body>
</html>`.trim();

  const sendOptions: Parameters<typeof resend.emails.send>[0] = {
    from: fromAddress,
    to: staffEmails,
    subject,
    html,
  };
  if (order.church.settings?.replyToEmail) {
    sendOptions.replyTo = order.church.settings.replyToEmail;
  }

  try {
    await resend.emails.send(sendOptions);
  } catch {
    // Best-effort — never throw
  }
}

export async function sendWelcomeEmail(userId: string): Promise<void> {
  if (!resend) return;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
    // @ts-expect-error — bypass tenancy for user lookups
    _bypassTenancyCheck: true,
  });

  if (!user?.email) return;

  const displayName = user.name ?? user.email;
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "noreply@table.steward.app";

  try {
    await resend.emails.send({
      from: fromAddress,
      to: user.email,
      subject: "Welcome to Steward Table",
      html: buildWelcomeEmailHtml(displayName),
    });
  } catch {
    // Best-effort — never throw, never block sign-up flow
  }
}

function buildWelcomeEmailHtml(displayName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Steward Table</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #0f172a; padding: 24px; text-align: center;">
      <p style="color: #94a3b8; font-size: 13px; margin: 0;">Steward Table</p>
    </div>
    <div style="padding: 32px 24px;">
      <h1 style="font-size: 22px; font-weight: 600; color: #0f172a; margin: 0 0 16px;">Welcome to Steward Table</h1>
      <p style="color: #64748b; font-size: 15px; margin: 0 0 24px;">Hi ${displayName}, your account has been created. You can now sign in and start managing your church orders.</p>
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

function buildEmailHtml(payload: OrderNotificationPayload, message: NotificationMessage): string {
  const bodyContent =
    payload.status === "SUBMITTED" || payload.status === "CONFIRMED"
      ? buildConfirmedBody(payload)
      : buildSimpleBody(payload, message);

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
      <h1 style="font-size: 22px; font-weight: 600; color: #0f172a; margin: 0 0 16px;">${message.headline}</h1>
      ${bodyContent}
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
