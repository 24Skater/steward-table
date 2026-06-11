import {
  InvalidTransitionError,
  isValidTransition,
  reachableFrom,
  transition,
} from "@/lib/orders/transitions";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    orderEvent: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        order: { update: vi.fn().mockResolvedValue({}) },
        orderEvent: { create: vi.fn().mockResolvedValue({}) },
      }),
    ),
  },
}));

// ─── isValidTransition() ─────────────────────────────────────────────────────

describe("isValidTransition()", () => {
  it("returns true for SUBMITTED -> CONFIRMED", () => {
    expect(isValidTransition("SUBMITTED", "CONFIRMED")).toBe(true);
  });

  it("returns true for SUBMITTED -> CANCELED", () => {
    expect(isValidTransition("SUBMITTED", "CANCELED")).toBe(true);
  });

  it("returns false for IN_KITCHEN -> SUBMITTED (not a valid edge)", () => {
    expect(isValidTransition("IN_KITCHEN", "SUBMITTED")).toBe(false);
  });

  it("returns false for COMPLETED -> DELIVERED", () => {
    expect(isValidTransition("COMPLETED", "DELIVERED")).toBe(false);
  });

  it("returns true for IN_KITCHEN -> IN_KITCHEN (same state = idempotent)", () => {
    expect(isValidTransition("IN_KITCHEN", "IN_KITCHEN")).toBe(true);
  });
});

// ─── reachableFrom() ─────────────────────────────────────────────────────────

describe("reachableFrom()", () => {
  it('reachableFrom("SUBMITTED") includes CONFIRMED and CANCELED', () => {
    const reachable = reachableFrom("SUBMITTED");
    expect(reachable).toContain("CONFIRMED");
    expect(reachable).toContain("CANCELED");
  });

  it('reachableFrom("COMPLETED") includes REFUNDED', () => {
    const reachable = reachableFrom("COMPLETED");
    expect(reachable).toContain("REFUNDED");
  });
});

// ─── transition() ────────────────────────────────────────────────────────────

describe("transition()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("valid transition SUBMITTED -> CONFIRMED: calls $transaction and returns correct result", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.order.findUnique).mockResolvedValueOnce({
      id: "order-1",
      churchId: "church-1",
      status: "SUBMITTED",
    } as never);

    const result = await transition("order-1", "CONFIRMED");

    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(result.orderId).toBe("order-1");
    expect(result.from).toBe("SUBMITTED");
    expect(result.to).toBe("CONFIRMED");
    expect(result.effects.length).toBeGreaterThan(0);
  });

  it("idempotent: SUBMITTED -> SUBMITTED does NOT call $transaction and returns empty effects", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.order.findUnique).mockResolvedValueOnce({
      id: "order-1",
      churchId: "church-1",
      status: "SUBMITTED",
    } as never);

    const result = await transition("order-1", "SUBMITTED");

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(result.effects).toHaveLength(0);
    expect(result.from).toBe("SUBMITTED");
    expect(result.to).toBe("SUBMITTED");
  });

  it("invalid transition throws InvalidTransitionError: SUBMITTED -> DELIVERED", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.order.findUnique).mockResolvedValueOnce({
      id: "order-1",
      churchId: "church-1",
      status: "SUBMITTED",
    } as never);

    await expect(transition("order-1", "DELIVERED")).rejects.toThrow(InvalidTransitionError);
  });

  it("order not found throws error with 'not found' in message", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.order.findUnique).mockResolvedValueOnce(null);

    await expect(transition("missing-order", "CONFIRMED")).rejects.toThrow(/not found/i);
  });

  it("DRAFT -> SUBMITTED produces effects including email.order_confirmation and notify.staff_new_order", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.order.findUnique).mockResolvedValueOnce({
      id: "order-1",
      churchId: "church-1",
      status: "DRAFT",
    } as never);

    const result = await transition("order-1", "SUBMITTED");

    const kinds = result.effects.map((e) => e.kind);
    expect(kinds).toContain("email.order_confirmation");
    expect(kinds).toContain("notify.staff_new_order");
  });

  it("custom queue: queue.enqueue is called once per effect", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.order.findUnique).mockResolvedValueOnce({
      id: "order-1",
      churchId: "church-1",
      status: "DRAFT",
    } as never);

    const mockQueue = { enqueue: vi.fn().mockResolvedValue(undefined) };

    const result = await transition("order-1", "SUBMITTED", { queue: mockQueue });

    expect(mockQueue.enqueue).toHaveBeenCalledTimes(result.effects.length);
    for (const effect of result.effects) {
      expect(mockQueue.enqueue).toHaveBeenCalledWith(effect);
    }
  });
});
