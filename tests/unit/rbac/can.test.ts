import { type CanContext, can } from "@/lib/rbac/can";
import type { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database to avoid needing a real DB in unit tests
vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    membership: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

function makeCtx(roles: Role[], overrides: Partial<CanContext> = {}): CanContext {
  return {
    userId: "user-1",
    churchId: "church-1",
    roles,
    ...overrides,
  };
}

describe("can() — RBAC permission gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Church ──────────────────────────────────────────────────────────
  describe("church.update", () => {
    it("allows ADMIN", async () => {
      const result = await can("church.update", makeCtx(["ADMIN"]));
      expect(result.allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      const result = await can("church.update", makeCtx(["OWNER"]));
      expect(result.allowed).toBe(true);
    });
    it("denies STAFF", async () => {
      const result = await can("church.update", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(false);
    });
    it("denies COOK", async () => {
      const result = await can("church.update", makeCtx(["COOK"]));
      expect(result.allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      const result = await can("church.update", makeCtx(["DRIVER"]));
      expect(result.allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      const result = await can("church.update", makeCtx(["VIEWER"]));
      expect(result.allowed).toBe(false);
    });
  });

  describe("church.delete", () => {
    it("allows OWNER", async () => {
      const result = await can("church.delete", makeCtx(["OWNER"]));
      expect(result.allowed).toBe(true);
    });
    it("denies ADMIN", async () => {
      const result = await can("church.delete", makeCtx(["ADMIN"]));
      expect(result.allowed).toBe(false);
    });
    it("denies STAFF", async () => {
      const result = await can("church.delete", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(false);
    });
    it("denies COOK", async () => {
      const result = await can("church.delete", makeCtx(["COOK"]));
      expect(result.allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      const result = await can("church.delete", makeCtx(["DRIVER"]));
      expect(result.allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      const result = await can("church.delete", makeCtx(["VIEWER"]));
      expect(result.allowed).toBe(false);
    });
  });

  describe("church.billing", () => {
    it("allows OWNER", async () => {
      const result = await can("church.billing", makeCtx(["OWNER"]));
      expect(result.allowed).toBe(true);
    });
    it("denies ADMIN", async () => {
      const result = await can("church.billing", makeCtx(["ADMIN"]));
      expect(result.allowed).toBe(false);
    });
    it("denies STAFF", async () => {
      const result = await can("church.billing", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(false);
    });
    it("denies COOK", async () => {
      const result = await can("church.billing", makeCtx(["COOK"]));
      expect(result.allowed).toBe(false);
    });
  });

  // ── Members ──────────────────────────────────────────────────────────
  describe("member.invite", () => {
    it("allows ADMIN", async () => {
      expect((await can("member.invite", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("member.invite", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("denies STAFF", async () => {
      expect((await can("member.invite", makeCtx(["STAFF"]))).allowed).toBe(false);
    });
    it("denies COOK", async () => {
      expect((await can("member.invite", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      expect((await can("member.invite", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("member.invite", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  describe("member.update", () => {
    it("allows OWNER unconditionally", async () => {
      expect((await can("member.update", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("allows ADMIN when target is not OWNER", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.membership.findFirst).mockResolvedValueOnce({
        id: "mem-1",
        roles: ["STAFF"],
      } as never);
      const result = await can(
        "member.update",
        makeCtx(["ADMIN"], { targetMembershipId: "mem-1" }),
      );
      expect(result.allowed).toBe(true);
    });
    it("denies ADMIN when target is OWNER", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.membership.findFirst).mockResolvedValueOnce({
        id: "mem-2",
        roles: ["OWNER"],
      } as never);
      const result = await can(
        "member.update",
        makeCtx(["ADMIN"], { targetMembershipId: "mem-2" }),
      );
      expect(result.allowed).toBe(false);
    });
    it("allows ADMIN when no targetMembershipId provided", async () => {
      const result = await can("member.update", makeCtx(["ADMIN"]));
      expect(result.allowed).toBe(true);
    });
    it("denies STAFF", async () => {
      expect((await can("member.update", makeCtx(["STAFF"]))).allowed).toBe(false);
    });
    it("denies COOK", async () => {
      expect((await can("member.update", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      expect((await can("member.update", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("member.update", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  describe("member.remove", () => {
    it("allows OWNER unconditionally", async () => {
      expect((await can("member.remove", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("allows ADMIN when target is not OWNER", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.membership.findFirst).mockResolvedValueOnce({
        id: "mem-1",
        roles: ["ADMIN"],
      } as never);
      const result = await can(
        "member.remove",
        makeCtx(["ADMIN"], { targetMembershipId: "mem-1" }),
      );
      expect(result.allowed).toBe(true);
    });
    it("denies ADMIN when target is OWNER", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.membership.findFirst).mockResolvedValueOnce({
        id: "mem-2",
        roles: ["OWNER"],
      } as never);
      const result = await can(
        "member.remove",
        makeCtx(["ADMIN"], { targetMembershipId: "mem-2" }),
      );
      expect(result.allowed).toBe(false);
    });
    it("denies STAFF", async () => {
      expect((await can("member.remove", makeCtx(["STAFF"]))).allowed).toBe(false);
    });
  });

  // ── Catalog ──────────────────────────────────────────────────────────
  describe("catalog.read", () => {
    it("allows STAFF", async () => {
      expect((await can("catalog.read", makeCtx(["STAFF"]))).allowed).toBe(true);
    });
    it("allows ADMIN", async () => {
      expect((await can("catalog.read", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("catalog.read", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("allows VIEWER", async () => {
      expect((await can("catalog.read", makeCtx(["VIEWER"]))).allowed).toBe(true);
    });
    it("allows COOK with OPEN catalog", async () => {
      const result = await can("catalog.read", makeCtx(["COOK"], { catalogStatus: "OPEN" }));
      expect(result.allowed).toBe(true);
    });
    it("allows COOK with no catalogStatus provided (no filter context)", async () => {
      const result = await can("catalog.read", makeCtx(["COOK"]));
      expect(result.allowed).toBe(true);
      expect(result.restrictions?.restriction).toBe("OPEN catalogs only");
    });
    it("denies COOK with DRAFT catalog", async () => {
      const result = await can("catalog.read", makeCtx(["COOK"], { catalogStatus: "DRAFT" }));
      expect(result.allowed).toBe(false);
    });
    it("denies COOK with CLOSED catalog", async () => {
      const result = await can("catalog.read", makeCtx(["COOK"], { catalogStatus: "CLOSED" }));
      expect(result.allowed).toBe(false);
    });
    it("denies COOK with ARCHIVED catalog", async () => {
      const result = await can("catalog.read", makeCtx(["COOK"], { catalogStatus: "ARCHIVED" }));
      expect(result.allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      expect((await can("catalog.read", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
  });

  describe("catalog.edit", () => {
    it("allows ADMIN", async () => {
      expect((await can("catalog.edit", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("catalog.edit", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("denies STAFF", async () => {
      expect((await can("catalog.edit", makeCtx(["STAFF"]))).allowed).toBe(false);
    });
    it("denies COOK", async () => {
      expect((await can("catalog.edit", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      expect((await can("catalog.edit", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("catalog.edit", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  describe("catalog.publish", () => {
    it("allows ADMIN", async () => {
      expect((await can("catalog.publish", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("catalog.publish", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("denies STAFF", async () => {
      expect((await can("catalog.publish", makeCtx(["STAFF"]))).allowed).toBe(false);
    });
    it("denies COOK", async () => {
      expect((await can("catalog.publish", makeCtx(["COOK"]))).allowed).toBe(false);
    });
  });

  // ── Inventory ────────────────────────────────────────────────────────
  describe("inventory.read", () => {
    it("allows STAFF", async () => {
      expect((await can("inventory.read", makeCtx(["STAFF"]))).allowed).toBe(true);
    });
    it("allows ADMIN", async () => {
      expect((await can("inventory.read", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("inventory.read", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("allows COOK", async () => {
      expect((await can("inventory.read", makeCtx(["COOK"]))).allowed).toBe(true);
    });
    it("denies DRIVER", async () => {
      expect((await can("inventory.read", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("inventory.read", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  describe("inventory.adjust", () => {
    it("allows ADMIN", async () => {
      expect((await can("inventory.adjust", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("inventory.adjust", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("allows COOK", async () => {
      expect((await can("inventory.adjust", makeCtx(["COOK"]))).allowed).toBe(true);
    });
    it("allows STAFF with OPEN catalog", async () => {
      const result = await can("inventory.adjust", makeCtx(["STAFF"], { catalogStatus: "OPEN" }));
      expect(result.allowed).toBe(true);
      expect(result.restrictions?.restriction).toBe("OPEN catalogs only");
    });
    it("allows STAFF with no catalogStatus (no filter context)", async () => {
      const result = await can("inventory.adjust", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(true);
    });
    it("denies STAFF with CLOSED catalog", async () => {
      const result = await can("inventory.adjust", makeCtx(["STAFF"], { catalogStatus: "CLOSED" }));
      expect(result.allowed).toBe(false);
    });
    it("denies STAFF with DRAFT catalog", async () => {
      const result = await can("inventory.adjust", makeCtx(["STAFF"], { catalogStatus: "DRAFT" }));
      expect(result.allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      expect((await can("inventory.adjust", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("inventory.adjust", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  // ── Customers ────────────────────────────────────────────────────────
  describe("customer.read", () => {
    it("allows STAFF", async () => {
      expect((await can("customer.read", makeCtx(["STAFF"]))).allowed).toBe(true);
    });
    it("allows ADMIN", async () => {
      expect((await can("customer.read", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("customer.read", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("allows DRIVER for own deliveries (driverId matches userId)", async () => {
      const result = await can("customer.read", makeCtx(["DRIVER"], { driverId: "user-1" }));
      expect(result.allowed).toBe(true);
      expect(result.restrictions?.restriction).toContain("name, phone, address");
    });
    it("allows DRIVER when no driverId provided (no filter context)", async () => {
      const result = await can("customer.read", makeCtx(["DRIVER"]));
      expect(result.allowed).toBe(true);
    });
    it("denies DRIVER for another driver's deliveries", async () => {
      const result = await can("customer.read", makeCtx(["DRIVER"], { driverId: "other-driver" }));
      expect(result.allowed).toBe(false);
    });
    it("denies COOK", async () => {
      expect((await can("customer.read", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("customer.read", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  describe("customer.edit", () => {
    it("allows STAFF", async () => {
      expect((await can("customer.edit", makeCtx(["STAFF"]))).allowed).toBe(true);
    });
    it("allows ADMIN", async () => {
      expect((await can("customer.edit", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("customer.edit", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("denies DRIVER", async () => {
      expect((await can("customer.edit", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("denies COOK", async () => {
      expect((await can("customer.edit", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("customer.edit", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  describe("customer.export", () => {
    it("allows ADMIN", async () => {
      expect((await can("customer.export", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("customer.export", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("denies STAFF", async () => {
      expect((await can("customer.export", makeCtx(["STAFF"]))).allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      expect((await can("customer.export", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("denies COOK", async () => {
      expect((await can("customer.export", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("customer.export", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  // ── Orders ───────────────────────────────────────────────────────────
  describe("order.read", () => {
    it("allows STAFF", async () => {
      expect((await can("order.read", makeCtx(["STAFF"]))).allowed).toBe(true);
    });
    it("allows ADMIN", async () => {
      expect((await can("order.read", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("order.read", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("allows COOK with restrictions", async () => {
      const result = await can("order.read", makeCtx(["COOK"]));
      expect(result.allowed).toBe(true);
      expect(result.restrictions?.restriction).toContain("CONFIRMED");
    });
    it("allows DRIVER with own-delivery restriction", async () => {
      const result = await can("order.read", makeCtx(["DRIVER"]));
      expect(result.allowed).toBe(true);
      expect(result.restrictions?.restriction).toContain("own deliveries");
    });
    it("allows VIEWER with aggregated restriction", async () => {
      const result = await can("order.read", makeCtx(["VIEWER"]));
      expect(result.allowed).toBe(true);
      expect(result.restrictions?.restriction).toContain("aggregated");
    });
    it("VIEWER restriction excludes individual rows and customer PII", async () => {
      const result = await can("order.read", makeCtx(["VIEWER"]));
      expect(result.restrictions?.restriction).toContain("no individual rows");
      expect(result.restrictions?.restriction).toContain("no customer PII");
    });
  });

  describe("order.create", () => {
    it("allows STAFF", async () => {
      expect((await can("order.create", makeCtx(["STAFF"]))).allowed).toBe(true);
    });
    it("allows ADMIN", async () => {
      expect((await can("order.create", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("order.create", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("denies COOK", async () => {
      expect((await can("order.create", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      expect((await can("order.create", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("order.create", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  describe("order.update", () => {
    it("allows STAFF", async () => {
      expect((await can("order.update", makeCtx(["STAFF"]))).allowed).toBe(true);
    });
    it("allows ADMIN", async () => {
      expect((await can("order.update", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("order.update", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("denies COOK", async () => {
      expect((await can("order.update", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      expect((await can("order.update", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("order.update", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  describe("order.kitchen", () => {
    it("allows STAFF", async () => {
      expect((await can("order.kitchen", makeCtx(["STAFF"]))).allowed).toBe(true);
    });
    it("allows ADMIN", async () => {
      expect((await can("order.kitchen", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("order.kitchen", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("allows COOK", async () => {
      expect((await can("order.kitchen", makeCtx(["COOK"]))).allowed).toBe(true);
    });
    it("denies DRIVER", async () => {
      expect((await can("order.kitchen", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("order.kitchen", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  describe("order.deliver", () => {
    it("allows ADMIN", async () => {
      expect((await can("order.deliver", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("order.deliver", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("allows DRIVER for own delivery (driverId matches userId)", async () => {
      const result = await can("order.deliver", makeCtx(["DRIVER"], { driverId: "user-1" }));
      expect(result.allowed).toBe(true);
    });
    it("allows DRIVER when no driverId provided (no filter context)", async () => {
      const result = await can("order.deliver", makeCtx(["DRIVER"]));
      expect(result.allowed).toBe(true);
    });
    it("denies DRIVER for another driver's delivery", async () => {
      const result = await can("order.deliver", makeCtx(["DRIVER"], { driverId: "other-driver" }));
      expect(result.allowed).toBe(false);
    });
    it("denies STAFF", async () => {
      expect((await can("order.deliver", makeCtx(["STAFF"]))).allowed).toBe(false);
    });
    it("denies COOK", async () => {
      expect((await can("order.deliver", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("order.deliver", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  describe("order.cancel", () => {
    it("allows ADMIN unconditionally", async () => {
      expect((await can("order.cancel", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER unconditionally", async () => {
      expect((await can("order.cancel", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("allows STAFF for DRAFT order", async () => {
      const result = await can("order.cancel", makeCtx(["STAFF"], { orderStatus: "DRAFT" }));
      expect(result.allowed).toBe(true);
    });
    it("allows STAFF for SUBMITTED order", async () => {
      const result = await can("order.cancel", makeCtx(["STAFF"], { orderStatus: "SUBMITTED" }));
      expect(result.allowed).toBe(true);
    });
    it("allows STAFF for CONFIRMED order", async () => {
      const result = await can("order.cancel", makeCtx(["STAFF"], { orderStatus: "CONFIRMED" }));
      expect(result.allowed).toBe(true);
    });
    it("allows STAFF for their own recent order regardless of status", async () => {
      const result = await can(
        "order.cancel",
        makeCtx(["STAFF"], {
          orderCreatedById: "user-1",
          orderCreatedAt: new Date(),
          orderStatus: "AWAITING_PICKUP",
        }),
      );
      expect(result.allowed).toBe(true);
    });
    it("denies STAFF for completed old order created by someone else", async () => {
      const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = await can(
        "order.cancel",
        makeCtx(["STAFF"], {
          orderStatus: "COMPLETED",
          orderCreatedAt: oldDate,
          orderCreatedById: "other-user",
        }),
      );
      expect(result.allowed).toBe(false);
    });
    it("denies STAFF for own old order (beyond 1 hour)", async () => {
      const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = await can(
        "order.cancel",
        makeCtx(["STAFF"], {
          orderStatus: "COMPLETED",
          orderCreatedAt: oldDate,
          orderCreatedById: "user-1",
        }),
      );
      expect(result.allowed).toBe(false);
    });
    it("denies COOK", async () => {
      expect((await can("order.cancel", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      expect((await can("order.cancel", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("order.cancel", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  describe("order.refund", () => {
    it("allows ADMIN", async () => {
      expect((await can("order.refund", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("order.refund", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("allows STAFF with cap restriction", async () => {
      const result = await can("order.refund", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(true);
      expect(result.restrictions?.restriction).toContain("staffRefundCapCents");
    });
    it("STAFF restriction mentions partial refunds", async () => {
      const result = await can("order.refund", makeCtx(["STAFF"]));
      expect(result.restrictions?.restriction).toContain("partial refunds");
    });
    it("denies COOK", async () => {
      expect((await can("order.refund", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      expect((await can("order.refund", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("order.refund", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  // ── Payments ─────────────────────────────────────────────────────────
  describe("payment.read", () => {
    it("allows STAFF", async () => {
      expect((await can("payment.read", makeCtx(["STAFF"]))).allowed).toBe(true);
    });
    it("allows ADMIN", async () => {
      expect((await can("payment.read", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("payment.read", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("denies COOK", async () => {
      expect((await can("payment.read", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      expect((await can("payment.read", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("payment.read", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  // ── Settings ─────────────────────────────────────────────────────────
  describe("settings.*", () => {
    const settingsActions = [
      "settings.payment",
      "settings.tax",
      "settings.receipt",
      "settings.email",
      "settings.branding",
    ] as const;

    for (const action of settingsActions) {
      it(`${action}: allows ADMIN`, async () => {
        expect((await can(action, makeCtx(["ADMIN"]))).allowed).toBe(true);
      });
      it(`${action}: allows OWNER`, async () => {
        expect((await can(action, makeCtx(["OWNER"]))).allowed).toBe(true);
      });
      it(`${action}: denies STAFF`, async () => {
        expect((await can(action, makeCtx(["STAFF"]))).allowed).toBe(false);
      });
      it(`${action}: denies COOK`, async () => {
        expect((await can(action, makeCtx(["COOK"]))).allowed).toBe(false);
      });
      it(`${action}: denies DRIVER`, async () => {
        expect((await can(action, makeCtx(["DRIVER"]))).allowed).toBe(false);
      });
      it(`${action}: denies VIEWER`, async () => {
        expect((await can(action, makeCtx(["VIEWER"]))).allowed).toBe(false);
      });
    }
  });

  // ── Reports ──────────────────────────────────────────────────────────
  describe("report.read", () => {
    it("allows ADMIN", async () => {
      expect((await can("report.read", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("report.read", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("allows STAFF with today-only restriction", async () => {
      const result = await can("report.read", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(true);
      expect(result.restrictions?.restriction).toContain("today");
    });
    it("allows VIEWER with aggregated restriction", async () => {
      const result = await can("report.read", makeCtx(["VIEWER"]));
      expect(result.allowed).toBe(true);
      expect(result.restrictions?.restriction).toContain("aggregated");
    });
    it("VIEWER restriction excludes customer-level rows", async () => {
      const result = await can("report.read", makeCtx(["VIEWER"]));
      expect(result.restrictions?.restriction).toContain("no customer-level rows");
    });
    it("denies COOK", async () => {
      expect((await can("report.read", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      expect((await can("report.read", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
  });

  describe("report.export", () => {
    it("allows ADMIN", async () => {
      expect((await can("report.export", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("report.export", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("denies STAFF", async () => {
      expect((await can("report.export", makeCtx(["STAFF"]))).allowed).toBe(false);
    });
    it("denies COOK", async () => {
      expect((await can("report.export", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      expect((await can("report.export", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("report.export", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  // ── Audit ────────────────────────────────────────────────────────────
  describe("audit.read", () => {
    it("allows ADMIN", async () => {
      expect((await can("audit.read", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("allows OWNER", async () => {
      expect((await can("audit.read", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("denies STAFF", async () => {
      expect((await can("audit.read", makeCtx(["STAFF"]))).allowed).toBe(false);
    });
    it("denies COOK", async () => {
      expect((await can("audit.read", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("denies DRIVER", async () => {
      expect((await can("audit.read", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("denies VIEWER", async () => {
      expect((await can("audit.read", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  // ── Role inheritance ─────────────────────────────────────────────────
  describe("Admin-chain inheritance", () => {
    it("OWNER inherits ADMIN permissions (church.update)", async () => {
      expect((await can("church.update", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("OWNER inherits STAFF permissions (order.create)", async () => {
      expect((await can("order.create", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("OWNER inherits STAFF permissions (payment.read)", async () => {
      expect((await can("payment.read", makeCtx(["OWNER"]))).allowed).toBe(true);
    });
    it("ADMIN inherits STAFF permissions (order.create)", async () => {
      expect((await can("order.create", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("ADMIN inherits STAFF permissions (payment.read)", async () => {
      expect((await can("payment.read", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("ADMIN inherits STAFF permissions (customer.edit)", async () => {
      expect((await can("customer.edit", makeCtx(["ADMIN"]))).allowed).toBe(true);
    });
    it("COOK does NOT inherit STAFF permissions (order.create)", async () => {
      expect((await can("order.create", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("COOK does NOT inherit STAFF permissions (customer.edit)", async () => {
      expect((await can("customer.edit", makeCtx(["COOK"]))).allowed).toBe(false);
    });
    it("DRIVER does NOT inherit STAFF permissions", async () => {
      expect((await can("order.create", makeCtx(["DRIVER"]))).allowed).toBe(false);
    });
    it("VIEWER does NOT inherit any admin permissions", async () => {
      expect((await can("church.update", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
    it("VIEWER does NOT inherit STAFF permissions", async () => {
      expect((await can("order.create", makeCtx(["VIEWER"]))).allowed).toBe(false);
    });
  });

  // ── Multi-role scenarios ──────────────────────────────────────────────
  describe("Multi-role scenarios", () => {
    it("user with both STAFF and COOK can access order.kitchen", async () => {
      expect((await can("order.kitchen", makeCtx(["STAFF", "COOK"]))).allowed).toBe(true);
    });
    it("user with STAFF role gets STAFF-level access even if also VIEWER", async () => {
      expect((await can("customer.edit", makeCtx(["STAFF", "VIEWER"]))).allowed).toBe(true);
    });
  });

  // ── Audit log on deny ────────────────────────────────────────────────
  describe("AuditLog on deny", () => {
    it("writes audit log when permission is denied", async () => {
      const { db } = await import("@/lib/db");
      await can("church.delete", makeCtx(["STAFF"]));
      expect(db.auditLog.create).toHaveBeenCalled();
    });
    it("does NOT write audit log when permission is allowed", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.auditLog.create).mockClear();
      await can("church.delete", makeCtx(["OWNER"]));
      expect(db.auditLog.create).not.toHaveBeenCalled();
    });
    it("audit log includes action, actorId, churchId, and reason", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.auditLog.create).mockClear();
      await can(
        "church.billing",
        makeCtx(["ADMIN"], { ip: "1.2.3.4", userAgent: "TestAgent/1.0" }),
      );
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "church.billing",
            actorId: "user-1",
            churchId: "church-1",
            ip: "1.2.3.4",
            userAgent: "TestAgent/1.0",
          }),
        }),
      );
    });
    it("audit log failure does not bubble up and block the deny response", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.auditLog.create).mockRejectedValueOnce(new Error("DB down"));
      const result = await can("church.delete", makeCtx(["STAFF"]));
      // The deny must still be returned even if audit log throws
      expect(result.allowed).toBe(false);
    });
  });

  // ── deny result properties ────────────────────────────────────────────
  describe("CanResult shape", () => {
    it("denied result has allowed=false and a reason string", async () => {
      const result = await can("church.delete", makeCtx(["ADMIN"]));
      expect(result.allowed).toBe(false);
      expect(typeof result.reason).toBe("string");
      expect(result.reason?.length).toBeGreaterThan(0);
    });
    it("allowed result has allowed=true and no reason", async () => {
      const result = await can("church.delete", makeCtx(["OWNER"]));
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
    it("conditional allow has restrictions object", async () => {
      const result = await can("order.refund", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(true);
      expect(result.restrictions).toBeDefined();
    });
    it("unconditional allow has no restrictions", async () => {
      const result = await can("order.refund", makeCtx(["ADMIN"]));
      expect(result.allowed).toBe(true);
      expect(result.restrictions).toBeUndefined();
    });
  });
});
