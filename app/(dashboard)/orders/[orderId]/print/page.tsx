import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { PaymentMethod, OrderStatus, FulfillmentType } from "@prisma/client";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatStatus(status: OrderStatus): string {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFulfillment(fulfillment: FulfillmentType): string {
  const labels: Record<FulfillmentType, string> = {
    PICKUP: "Pickup",
    DELIVERY: "Delivery",
    DINE_IN: "Dine-in",
  };
  return labels[fulfillment] ?? fulfillment;
}

function formatPaymentMethod(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    STRIPE_CARD: "Card",
    STRIPE_OTHER: "Other (Stripe)",
    CASH: "Cash",
    ZELLE: "Zelle",
    PAY_ON_PICKUP: "Pay on Pickup",
    OTHER: "Other",
  };
  return labels[method] ?? method;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PrintReceiptPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const activeMembership = session.user.memberships?.find(
    (m) => m.status === "ACTIVE",
  );
  if (!activeMembership) redirect("/auth/sign-in");

  const { churchId } = activeMembership;
  const { orderId } = await params;

  const order = await db.order.findFirst({
    where: { id: orderId, churchId },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
      },
      customer: {
        select: {
          name: true,
          email: true,
          phone: true,
        },
      },
      payments: {
        select: {
          method: true,
          status: true,
          amount: true,
        },
      },
      deliveryInfo: true,
      church: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!order) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>Order not found.</p>
      </div>
    );
  }

  const capturedPayment = order.payments.find(
    (p) => p.status === "CAPTURED" || p.status === "AUTHORIZED",
  ) ?? order.payments[0];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #f5f5f5;
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          color: #000;
        }

        .receipt-wrapper {
          display: flex;
          justify-content: center;
          padding: 2rem 1rem;
        }

        .receipt {
          background: #fff;
          width: 100%;
          max-width: 400px;
          padding: 1.5rem 1.25rem;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .church-name {
          font-size: 1.15rem;
          font-weight: 700;
          text-align: center;
          letter-spacing: 0.5px;
          margin-bottom: 0.75rem;
        }

        hr {
          border: none;
          border-top: 1px dashed #aaa;
          margin: 0.75rem 0;
        }

        .order-number {
          text-align: center;
          font-size: 1rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }

        .order-date {
          text-align: center;
          font-size: 0.8rem;
          color: #555;
          margin-bottom: 0.5rem;
        }

        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border: 1px solid #000;
          border-radius: 3px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-row {
          text-align: center;
          margin-bottom: 0.75rem;
        }

        .section-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #666;
          margin-bottom: 0.25rem;
        }

        .customer-block {
          margin-bottom: 0.5rem;
        }

        .customer-block p {
          font-size: 0.82rem;
          line-height: 1.5;
        }

        .fulfillment-block {
          margin-bottom: 0.5rem;
        }

        .fulfillment-block p {
          font-size: 0.82rem;
        }

        .item-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 0.2rem;
          gap: 0.5rem;
        }

        .item-name-qty {
          flex: 1;
          font-size: 0.82rem;
          white-space: nowrap;
          overflow: hidden;
        }

        .item-dots {
          flex: 1;
          border-bottom: 1px dotted #aaa;
          margin: 0 4px 3px 4px;
          min-width: 12px;
        }

        .item-price {
          font-size: 0.82rem;
          white-space: nowrap;
          text-align: right;
        }

        .totals-block {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.82rem;
        }

        .total-row.grand-total {
          font-weight: 700;
          font-size: 0.9rem;
          border-top: 1px solid #000;
          padding-top: 0.35rem;
          margin-top: 0.15rem;
        }

        .payment-method {
          font-size: 0.82rem;
          margin-top: 0.5rem;
        }

        .footer {
          text-align: center;
          font-size: 0.75rem;
          color: #555;
          margin-top: 0.25rem;
        }

        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .receipt-wrapper {
            padding: 0 !important;
          }

          .receipt {
            border: none !important;
            border-radius: 0 !important;
            padding: 0.5rem 0.75rem !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* Auto-print on load */}
      <script
        dangerouslySetInnerHTML={{
          __html: "window.onload = function() { window.print(); };",
        }}
      />

      <div className="receipt-wrapper">
        <div className="receipt">
          {/* Church name */}
          <div className="church-name">{order.church.name}</div>

          <hr />

          {/* Order number */}
          <div className="order-number">Order #{order.number}</div>

          {/* Date / time */}
          <div className="order-date">
            {formatDateTime(new Date(order.createdAt))}
          </div>

          {/* Status */}
          <div className="status-row">
            <span className="status-badge">{formatStatus(order.status)}</span>
          </div>

          {/* Customer */}
          <div className="customer-block">
            <div className="section-label">Customer</div>
            <p>{order.customer.name}</p>
            {order.customer.email && <p>{order.customer.email}</p>}
            {order.customer.phone && <p>{order.customer.phone}</p>}
          </div>

          {/* Fulfillment type */}
          <div className="fulfillment-block">
            <div className="section-label">Fulfillment</div>
            <p>{formatFulfillment(order.fulfillment)}</p>
          </div>

          <hr />

          {/* Items */}
          <div style={{ marginBottom: "0.25rem" }}>
            {order.items.map((item) => (
              <div key={item.id} className="item-row">
                <span className="item-name-qty">
                  {item.quantity} &times; {item.itemName}
                </span>
                <span className="item-dots" aria-hidden="true" />
                <span className="item-price">{formatCents(item.subtotal)}</span>
              </div>
            ))}
          </div>

          <hr />

          {/* Totals */}
          <div className="totals-block">
            <div className="total-row">
              <span>Subtotal</span>
              <span>{formatCents(order.subtotal)}</span>
            </div>
            {order.tax > 0 && (
              <div className="total-row">
                <span>Tax</span>
                <span>{formatCents(order.tax)}</span>
              </div>
            )}
            {order.tip > 0 && (
              <div className="total-row">
                <span>Tip</span>
                <span>{formatCents(order.tip)}</span>
              </div>
            )}
            <div className="total-row grand-total">
              <span>Total</span>
              <span>{formatCents(order.total)}</span>
            </div>
          </div>

          {/* Payment method */}
          {capturedPayment && (
            <div className="payment-method">
              <span className="section-label" style={{ display: "inline" }}>
                Payment:{" "}
              </span>
              {formatPaymentMethod(capturedPayment.method)}
            </div>
          )}

          <hr />

          {/* Footer */}
          <div className="footer">
            <p>Thank you!</p>
            <p>Powered by Steward Table</p>
          </div>
        </div>
      </div>
    </>
  );
}
