import {
  InvalidTransitionError,
  isValidTransition,
  reachableFrom,
  transition,
} from "@/lib/orders/transitions";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    orderEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback: (tx: unknown) => Promise<void>) =>
      callback({
        order: { update: vi.fn().mockResolvedValue({}) },
        orderEvent: { create: vi.fn().mockResolvedValue({}) },
      }),
    ),
  },
}));

describe("order state machine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isValidTransition()", () => {
    it("allows DRAFT -> SUBMITTED", () => {
      expect(isValidTransition("DRAFT", "SUBMITTED")).toBe(true);
    });
    it("allows SUBMITTED -> CONFIRMED", () => {
      expect(isValidTransition("SUBMITTED", "CONFIRMED")).toBe(true);
    });
    it("allows SUBMITTED -> CANCELED", () => {
      expect(isValidTransition("SUBMITTED", "CANCELED")).toBe(true);
    });
    it("allows CONFIRMED -> IN_KITCHEN", () => {
      expect(isValidTransition("CONFIRMED", "IN_KITCHEN")).toBe(true);
    });
    it("allows CONFIRMED -> CANCELED", () => {
      expect(isValidTransition("CONFIRMED", "CANCELED")).toBe(true);
    });
    it("allows IN_KITCHEN -> READY", () => {
      expect(isValidTransition("IN_KITCHEN", "READY")).toBe(true);
    });
    it("allows READY -> AWAITING_PICKUP", () => {
      expect(isValidTransition("READY", "AWAITING_PICKUP")).toBe(true);
    });
    it("allows READY -> OUT_FOR_DELIVERY", () => {
      expect(isValidTransition("READY", "OUT_FOR_DELIVERY")).toBe(true);
    });
    it("allows READY -> SERVED", () => {
      expect(isValidTransition("READY", "SERVED")).toBe(true);
    });
    it("allows AWAITING_PICKUP -> PICKED_UP", () => {
      expect(isValidTransition("AWAITING_PICKUP", "PICKED_UP")).toBe(true);
    });
    it("allows AWAITING_PICKUP -> CANCELED", () => {
      expect(isValidTransition("AWAITING_PICKUP", "CANCELED")).toBe(true);
    });
    it("allows OUT_FOR_DELIVERY -> DELIVERED", () => {
      expect(isValidTransition("OUT_FOR_DELIVERY", "DELIVERED")).toBe(true);
    });
    it("allows PICKED_UP -> COMPLETED", () => {
      expect(isValidTransition("PICKED_UP", "COMPLETED")).toBe(true);
    });
    it("allows DELIVERED -> COMPLETED", () => {
      expect(isValidTransition("DELIVERED", "COMPLETED")).toBe(true);
    });
    it("allows SERVED -> COMPLETED", () => {
      expect(isValidTransition("SERVED", "COMPLETED")).toBe(true);
    });
    it("allows COMPLETED -> REFUNDED", () => {
      expect(isValidTransition("COMPLETED", "REFUNDED")).toBe(true);
    });

    // Invalid transitions
    it("rejects DRAFT -> CONFIRMED (skip SUBMITTED)", () => {
      expect(isValidTransition("DRAFT", "CONFIRMED")).toBe(false);
    });
    it("rejects COMPLETED -> DRAFT (backwards)", () => {
      expect(isValidTransition("COMPLETED", "DRAFT")).toBe(false);
    });
    it("rejects CANCELED -> SUBMITTED (resurrection)", () => {
      expect(isValidTransition("CANCELED", "SUBMITTED")).toBe(false);
    });
    it("rejects REFUNDED -> COMPLETED (backwards)", () => {
      expect(isValidTransition("REFUNDED", "COMPLETED")).toBe(false);
    });
    it("rejects DELIVERED -> SUBMITTED", () => {
      expect(isValidTransition("DELIVERED", "SUBMITTED")).toBe(false);
    });

    // Idempotent same-state
    it("allows same-state transition (idempotent)", () => {
      expect(isValidTransition("SUBMITTED", "SUBMITTED")).toBe(true);
    });
  });

  describe("reachableFrom()", () => {
    it("DRAFT can reach SUBMITTED", () => {
      expect(reachableFrom("DRAFT")).toContain("SUBMITTED");
    });
    it("READY can reach AWAITING_PICKUP, OUT_FOR_DELIVERY, SERVED", () => {
      const reachable = reachableFrom("READY");
      expect(reachable).toContain("AWAITING_PICKUP");
      expect(reachable).toContain("OUT_FOR_DELIVERY");
      expect(reachable).toContain("SERVED");
    });
    it("COMPLETED can only reach REFUNDED", () => {
      expect(reachableFrom("COMPLETED")).toEqual(["REFUNDED"]);
    });
    it("REFUNDED has no reachable states", () => {
      expect(reachableFrom("REFUNDED")).toHaveLength(0);
    });
    it("CANCELED has no reachable states", () => {
      expect(reachableFrom("CANCELED")).toHaveLength(0);
    });
  });

  describe("transition() — idempotency", () => {
    it("returns no effects when from === to", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.order.findUnique).mockResolvedValueOnce({
        id: "order-1",
        churchId: "church-1",
        status: "SUBMITTED",
      } as never);

      const result = await transition("order-1", "SUBMITTED");
      expect(result.effects).toHaveLength(0);
      expect(result.from).toBe("SUBMITTED");
      expect(result.to).toBe("SUBMITTED");
    });
  });

  describe("transition() — valid transitions", () => {
    it("DRAFT -> SUBMITTED enqueues confirmation effects", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.order.findUnique).mockResolvedValueOnce({
        id: "order-1",
        churchId: "church-1",
        status: "DRAFT",
      } as never);

      const enqueued: string[] = [];
      const queue = {
        enqueue: vi.fn(async (e: { kind: string }) => {
          enqueued.push(e.kind);
        }),
      };

      const result = await transition("order-1", "SUBMITTED", { queue });
      expect(result.from).toBe("DRAFT");
      expect(result.to).toBe("SUBMITTED");
      expect(enqueued).toContain("email.order_confirmation");
      expect(enqueued).toContain("inventory.reserve");
      expect(enqueued).toContain("notify.staff_new_order");
    });

    it("COMPLETED -> REFUNDED enqueues stripe.refund and inventory.restock", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.order.findUnique).mockResolvedValueOnce({
        id: "order-1",
        churchId: "church-1",
        status: "COMPLETED",
      } as never);

      const enqueued: string[] = [];
      const queue = {
        enqueue: vi.fn(async (e: { kind: string }) => {
          enqueued.push(e.kind);
        }),
      };

      await transition("order-1", "REFUNDED", { queue });
      expect(enqueued).toContain("stripe.refund");
      expect(enqueued).toContain("inventory.restock");
    });
  });

  describe("transition() — invalid transitions", () => {
    it("throws InvalidTransitionError for DRAFT -> CONFIRMED", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.order.findUnique).mockResolvedValueOnce({
        id: "order-1",
        churchId: "church-1",
        status: "DRAFT",
      } as never);

      await expect(transition("order-1", "CONFIRMED")).rejects.toThrow(InvalidTransitionError);
    });

    it("throws InvalidTransitionError for CANCELED -> SUBMITTED", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.order.findUnique).mockResolvedValueOnce({
        id: "order-1",
        churchId: "church-1",
        status: "CANCELED",
      } as never);

      await expect(transition("order-1", "SUBMITTED")).rejects.toThrow(InvalidTransitionError);
    });
  });

  describe("transition() — order not found", () => {
    it("throws when order does not exist", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.order.findUnique).mockResolvedValueOnce(null);
      await expect(transition("nonexistent", "SUBMITTED")).rejects.toThrow("Order not found");
    });
  });
});
