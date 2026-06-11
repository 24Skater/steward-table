import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Invalid order transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

// Side effects are typed and queued post-commit via a SideEffectQueue interface.
// The queue itself is stubbed — wire up a real background job system (e.g., BullMQ or Trigger.dev)
// when ready to implement notifications and inventory moves.
export type SideEffectKind =
  | "email.order_confirmation"
  | "email.order_canceled"
  | "email.order_ready"
  | "sms.order_confirmation"
  | "sms.order_ready"
  | "sms.order_pickup_ready"
  | "sms.order_out_for_delivery"
  | "notify.staff_new_order"
  | "notify.customer_order_status"
  | "inventory.reserve"
  | "inventory.confirm"
  | "inventory.restock"
  | "stripe.refund"
  | "reporting.order_completed";

export interface SideEffect {
  kind: SideEffectKind;
  orderId: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
}

// TODO: Replace with real background job queue (e.g., BullMQ, Trigger.dev, Inngest)
export interface SideEffectQueue {
  enqueue(effect: SideEffect): Promise<void>;
}

// Default no-op queue — replace at the composition root
export const noopQueue: SideEffectQueue = {
  async enqueue(_effect: SideEffect): Promise<void> {
    // TODO: implement real queue
  },
};

export interface TransitionActor {
  userId?: string; // undefined for system/auto transitions
  roles?: string[];
}

export interface TransitionOptions {
  actorId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  queue?: SideEffectQueue;
}

// All valid (from → to) edges
type TransitionEdge = `${OrderStatus}->${OrderStatus}`;

const VALID_TRANSITIONS: ReadonlySet<TransitionEdge> = new Set([
  "DRAFT->SUBMITTED",
  "SUBMITTED->CONFIRMED",
  "SUBMITTED->CANCELED",
  "CONFIRMED->IN_KITCHEN",
  "CONFIRMED->CANCELED",
  "IN_KITCHEN->READY",
  "READY->AWAITING_PICKUP",
  "READY->OUT_FOR_DELIVERY",
  "READY->SERVED",
  "AWAITING_PICKUP->PICKED_UP",
  "AWAITING_PICKUP->CANCELED",
  "OUT_FOR_DELIVERY->DELIVERED",
  "PICKED_UP->COMPLETED",
  "DELIVERED->COMPLETED",
  "SERVED->COMPLETED",
  "COMPLETED->REFUNDED",
] as const);

function getSideEffects(from: OrderStatus, to: OrderStatus, orderId: string): SideEffect[] {
  const key = (kind: SideEffectKind): SideEffect => ({
    kind,
    orderId,
    idempotencyKey: `${orderId}:${from}:${to}:${kind}`,
  });

  switch (`${from}->${to}` as TransitionEdge) {
    case "DRAFT->SUBMITTED":
      return [
        key("email.order_confirmation"),
        key("sms.order_confirmation"),
        key("inventory.reserve"),
        key("notify.staff_new_order"),
      ];

    case "SUBMITTED->CONFIRMED":
      return [
        key("notify.customer_order_status"),
        key("inventory.confirm"),
      ];

    case "SUBMITTED->CANCELED":
    case "CONFIRMED->CANCELED":
    case "AWAITING_PICKUP->CANCELED":
      return [
        key("email.order_canceled"),
        key("inventory.restock"),
        key("notify.customer_order_status"),
        // stripe.refund only if payment was captured — handled by queue consumer
        key("stripe.refund"),
      ];

    case "IN_KITCHEN->READY":
      return [
        key("email.order_ready"),
        key("sms.order_ready"),
        key("notify.customer_order_status"),
      ];

    case "READY->AWAITING_PICKUP":
      return [key("sms.order_pickup_ready")];

    case "READY->OUT_FOR_DELIVERY":
      return [key("sms.order_out_for_delivery")];

    case "PICKED_UP->COMPLETED":
    case "DELIVERED->COMPLETED":
    case "SERVED->COMPLETED":
      return [key("reporting.order_completed")];

    case "COMPLETED->REFUNDED":
      return [
        key("stripe.refund"),
        key("inventory.restock"),
      ];

    default:
      return [];
  }
}

/**
 * The ONLY function that may write Order.status.
 * Direct `prisma.order.update({ data: { status: ... } })` calls anywhere else in the codebase are forbidden.
 *
 * Idempotent: re-applying the same transition is a safe no-op (returns current order).
 * Atomic: status update + OrderEvent written in one Prisma transaction.
 * Side effects are declared as a typed list and enqueued post-commit via SideEffectQueue.
 */
export async function transition(
  orderId: string,
  to: OrderStatus,
  opts: TransitionOptions = {},
): Promise<{ orderId: string; from: OrderStatus; to: OrderStatus; effects: SideEffect[] }> {
  const queue = opts.queue ?? noopQueue;

  // Fetch the current order (scoped by churchId via middleware would normally apply,
  // but transition() is typically called after auth checks, so we bypass here for the
  // internal status read — the calling API route is responsible for churchId scoping)
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, churchId: true, status: true },
    // @ts-expect-error — bypass tenancy for internal status reads in transition()
    _bypassTenancyCheck: true,
  });

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const from = order.status;

  // Idempotent: same transition is a no-op
  if (from === to) {
    return { orderId, from, to, effects: [] };
  }

  const edge = `${from}->${to}` as TransitionEdge;
  if (!VALID_TRANSITIONS.has(edge)) {
    throw new InvalidTransitionError(from, to);
  }

  const effects = getSideEffects(from, to, orderId);

  // Atomic: update status + write OrderEvent in one transaction
  await db.$transaction(async (tx) => {
    // IMPORTANT: This is the ONLY place Order.status is written.
    // Do not call prisma.order.update({ data: { status } }) anywhere else.
    await tx.order.update({
      where: { id: orderId },
      data: { status: to },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        actorId: opts.actorId,
        fromStatus: from,
        toStatus: to,
        reason: opts.reason,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: opts.metadata ? (opts.metadata as any) : undefined,
      },
    });
  });

  // Enqueue side effects post-commit (non-blocking; queue is responsible for retries)
  await Promise.allSettled(effects.map((e) => queue.enqueue(e)));

  return { orderId, from, to, effects };
}

// Convenience: check if a transition is valid without executing it
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true; // idempotent
  return VALID_TRANSITIONS.has(`${from}->${to}`);
}

// Get all states reachable from a given state
export function reachableFrom(from: OrderStatus): OrderStatus[] {
  const results: OrderStatus[] = [];
  for (const edge of VALID_TRANSITIONS) {
    const [edgeFrom, edgeTo] = edge.split("->") as [OrderStatus, OrderStatus];
    if (edgeFrom === from) {
      results.push(edgeTo);
    }
  }
  return results;
}
