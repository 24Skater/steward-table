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

  // ── church.update ────────────────────────────────────────────────────
  describe("church.update", () => {
    it("allows OWNER", async () => {
      // Arrange
      const ctx = makeCtx(["OWNER"]);
      // Act
      const result = await can("church.update", ctx);
      // Assert
      expect(result.allowed).toBe(true);
    });

    it("allows ADMIN", async () => {
      const result = await can("church.update", makeCtx(["ADMIN"]));
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

  // ── member.invite ────────────────────────────────────────────────────
  describe("member.invite", () => {
    it("allows OWNER", async () => {
      const result = await can("member.invite", makeCtx(["OWNER"]));
      expect(result.allowed).toBe(true);
    });

    it("allows ADMIN", async () => {
      const result = await can("member.invite", makeCtx(["ADMIN"]));
      expect(result.allowed).toBe(true);
    });

    it("denies STAFF", async () => {
      const result = await can("member.invite", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(false);
    });

    it("denies COOK", async () => {
      const result = await can("member.invite", makeCtx(["COOK"]));
      expect(result.allowed).toBe(false);
    });

    it("denies DRIVER", async () => {
      const result = await can("member.invite", makeCtx(["DRIVER"]));
      expect(result.allowed).toBe(false);
    });

    it("denies VIEWER", async () => {
      const result = await can("member.invite", makeCtx(["VIEWER"]));
      expect(result.allowed).toBe(false);
    });
  });

  // ── member.update ────────────────────────────────────────────────────
  describe("member.update", () => {
    it("allows OWNER targeting any membership unconditionally", async () => {
      // Arrange
      const ctx = makeCtx(["OWNER"], { targetMembershipId: "mem-owner" });
      // Act
      const result = await can("member.update", ctx);
      // Assert
      expect(result.allowed).toBe(true);
    });

    it("allows ADMIN targeting a non-OWNER membership", async () => {
      // Arrange
      const { db } = await import("@/lib/db");
      vi.mocked(db.membership.findFirst).mockResolvedValueOnce({
        id: "mem-1",
        roles: ["STAFF"],
      } as never);
      const ctx = makeCtx(["ADMIN"], { targetMembershipId: "mem-1" });
      // Act
      const result = await can("member.update", ctx);
      // Assert
      expect(result.allowed).toBe(true);
    });

    it("denies ADMIN targeting an OWNER membership", async () => {
      // Arrange
      const { db } = await import("@/lib/db");
      vi.mocked(db.membership.findFirst).mockResolvedValueOnce({
        id: "mem-2",
        roles: ["OWNER"],
      } as never);
      const ctx = makeCtx(["ADMIN"], { targetMembershipId: "mem-2" });
      // Act
      const result = await can("member.update", ctx);
      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("OWNER");
    });

    it("allows ADMIN when no targetMembershipId is provided", async () => {
      const result = await can("member.update", makeCtx(["ADMIN"]));
      expect(result.allowed).toBe(true);
    });

    it("denies STAFF", async () => {
      const result = await can("member.update", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(false);
    });

    it("denies COOK", async () => {
      const result = await can("member.update", makeCtx(["COOK"]));
      expect(result.allowed).toBe(false);
    });

    it("denies DRIVER", async () => {
      const result = await can("member.update", makeCtx(["DRIVER"]));
      expect(result.allowed).toBe(false);
    });

    it("denies VIEWER", async () => {
      const result = await can("member.update", makeCtx(["VIEWER"]));
      expect(result.allowed).toBe(false);
    });
  });

  // ── member.remove ────────────────────────────────────────────────────
  describe("member.remove", () => {
    it("allows OWNER targeting any membership unconditionally", async () => {
      const result = await can(
        "member.remove",
        makeCtx(["OWNER"], { targetMembershipId: "mem-any" }),
      );
      expect(result.allowed).toBe(true);
    });

    it("allows ADMIN targeting a non-OWNER membership", async () => {
      // Arrange
      const { db } = await import("@/lib/db");
      vi.mocked(db.membership.findFirst).mockResolvedValueOnce({
        id: "mem-1",
        roles: ["STAFF"],
      } as never);
      const ctx = makeCtx(["ADMIN"], { targetMembershipId: "mem-1" });
      // Act
      const result = await can("member.remove", ctx);
      // Assert
      expect(result.allowed).toBe(true);
    });

    it("denies ADMIN targeting an OWNER membership", async () => {
      // Arrange
      const { db } = await import("@/lib/db");
      vi.mocked(db.membership.findFirst).mockResolvedValueOnce({
        id: "mem-2",
        roles: ["OWNER"],
      } as never);
      const ctx = makeCtx(["ADMIN"], { targetMembershipId: "mem-2" });
      // Act
      const result = await can("member.remove", ctx);
      // Assert
      expect(result.allowed).toBe(false);
    });

    it("denies STAFF", async () => {
      const result = await can("member.remove", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(false);
    });

    it("denies COOK", async () => {
      const result = await can("member.remove", makeCtx(["COOK"]));
      expect(result.allowed).toBe(false);
    });

    it("denies VIEWER", async () => {
      const result = await can("member.remove", makeCtx(["VIEWER"]));
      expect(result.allowed).toBe(false);
    });
  });

  // ── catalog.edit ────────────────────────────────────────────────────
  describe("catalog.edit", () => {
    it("allows OWNER", async () => {
      const result = await can("catalog.edit", makeCtx(["OWNER"]));
      expect(result.allowed).toBe(true);
    });

    it("allows ADMIN", async () => {
      const result = await can("catalog.edit", makeCtx(["ADMIN"]));
      expect(result.allowed).toBe(true);
    });

    it("denies STAFF", async () => {
      const result = await can("catalog.edit", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(false);
    });

    it("denies COOK", async () => {
      const result = await can("catalog.edit", makeCtx(["COOK"]));
      expect(result.allowed).toBe(false);
    });

    it("denies DRIVER", async () => {
      const result = await can("catalog.edit", makeCtx(["DRIVER"]));
      expect(result.allowed).toBe(false);
    });

    it("denies VIEWER", async () => {
      const result = await can("catalog.edit", makeCtx(["VIEWER"]));
      expect(result.allowed).toBe(false);
    });
  });

  // ── order.kitchen ────────────────────────────────────────────────────
  describe("order.kitchen", () => {
    it("allows COOK", async () => {
      const result = await can("order.kitchen", makeCtx(["COOK"]));
      expect(result.allowed).toBe(true);
    });

    it("allows STAFF", async () => {
      const result = await can("order.kitchen", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(true);
    });

    it("allows ADMIN (inherits STAFF)", async () => {
      const result = await can("order.kitchen", makeCtx(["ADMIN"]));
      expect(result.allowed).toBe(true);
    });

    it("allows OWNER (inherits STAFF via ADMIN)", async () => {
      const result = await can("order.kitchen", makeCtx(["OWNER"]));
      expect(result.allowed).toBe(true);
    });

    it("denies VIEWER", async () => {
      const result = await can("order.kitchen", makeCtx(["VIEWER"]));
      expect(result.allowed).toBe(false);
    });

    it("denies DRIVER", async () => {
      const result = await can("order.kitchen", makeCtx(["DRIVER"]));
      expect(result.allowed).toBe(false);
    });
  });

  // ── order.update ────────────────────────────────────────────────────
  describe("order.update", () => {
    it("allows STAFF", async () => {
      const result = await can("order.update", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(true);
    });

    it("allows ADMIN (inherits STAFF)", async () => {
      const result = await can("order.update", makeCtx(["ADMIN"]));
      expect(result.allowed).toBe(true);
    });

    it("allows OWNER (inherits STAFF via ADMIN)", async () => {
      const result = await can("order.update", makeCtx(["OWNER"]));
      expect(result.allowed).toBe(true);
    });

    it("denies VIEWER", async () => {
      const result = await can("order.update", makeCtx(["VIEWER"]));
      expect(result.allowed).toBe(false);
    });

    it("denies COOK", async () => {
      const result = await can("order.update", makeCtx(["COOK"]));
      expect(result.allowed).toBe(false);
    });

    it("denies DRIVER", async () => {
      const result = await can("order.update", makeCtx(["DRIVER"]));
      expect(result.allowed).toBe(false);
    });
  });

  // ── settings.payment ────────────────────────────────────────────────
  describe("settings.payment", () => {
    it("allows OWNER", async () => {
      const result = await can("settings.payment", makeCtx(["OWNER"]));
      expect(result.allowed).toBe(true);
    });

    it("allows ADMIN", async () => {
      const result = await can("settings.payment", makeCtx(["ADMIN"]));
      expect(result.allowed).toBe(true);
    });

    it("denies STAFF", async () => {
      const result = await can("settings.payment", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(false);
    });

    it("denies COOK", async () => {
      const result = await can("settings.payment", makeCtx(["COOK"]));
      expect(result.allowed).toBe(false);
    });

    it("denies DRIVER", async () => {
      const result = await can("settings.payment", makeCtx(["DRIVER"]));
      expect(result.allowed).toBe(false);
    });

    it("denies VIEWER", async () => {
      const result = await can("settings.payment", makeCtx(["VIEWER"]));
      expect(result.allowed).toBe(false);
    });
  });

  // ── Role inheritance ─────────────────────────────────────────────────
  describe("Role inheritance", () => {
    it("OWNER inherits ADMIN permissions — church.update is allowed", async () => {
      // OWNER → expands to {OWNER, ADMIN, STAFF}; church.update requires ADMIN
      const result = await can("church.update", makeCtx(["OWNER"]));
      expect(result.allowed).toBe(true);
    });

    it("OWNER inherits STAFF permissions — order.update is allowed", async () => {
      // OWNER → expands to {OWNER, ADMIN, STAFF}; order.update requires STAFF
      const result = await can("order.update", makeCtx(["OWNER"]));
      expect(result.allowed).toBe(true);
    });

    it("ADMIN inherits STAFF permissions — order.update is allowed", async () => {
      // ADMIN → expands to {ADMIN, STAFF}; order.update requires STAFF
      const result = await can("order.update", makeCtx(["ADMIN"]));
      expect(result.allowed).toBe(true);
    });

    it("ADMIN inherits STAFF permissions — payment.read is allowed", async () => {
      const result = await can("payment.read", makeCtx(["ADMIN"]));
      expect(result.allowed).toBe(true);
    });

    it("STAFF does NOT inherit ADMIN permissions — church.update is denied", async () => {
      const result = await can("church.update", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(false);
    });

    it("COOK does NOT inherit STAFF permissions — order.update is denied", async () => {
      const result = await can("order.update", makeCtx(["COOK"]));
      expect(result.allowed).toBe(false);
    });

    it("VIEWER does NOT inherit any elevated permissions", async () => {
      const resultAdmin = await can("church.update", makeCtx(["VIEWER"]));
      const resultStaff = await can("order.update", makeCtx(["VIEWER"]));
      expect(resultAdmin.allowed).toBe(false);
      expect(resultStaff.allowed).toBe(false);
    });
  });

  // ── Audit log behaviour ──────────────────────────────────────────────
  describe("Audit log on deny", () => {
    it("writes an audit log entry when permission is denied", async () => {
      // Arrange
      const { db } = await import("@/lib/db");
      const ctx = makeCtx(["STAFF"]);
      // Act
      await can("church.update", ctx);
      // Assert
      expect(db.auditLog.create).toHaveBeenCalled();
    });

    it("does NOT write an audit log entry when permission is allowed", async () => {
      // Arrange
      const { db } = await import("@/lib/db");
      const ctx = makeCtx(["OWNER"]);
      // Act
      await can("church.update", ctx);
      // Assert
      expect(db.auditLog.create).not.toHaveBeenCalled();
    });

    it("audit log payload contains action, actorId, churchId", async () => {
      // Arrange
      const { db } = await import("@/lib/db");
      const ctx = makeCtx(["STAFF"], { ip: "10.0.0.1", userAgent: "TestRunner/1.0" });
      // Act
      await can("church.update", ctx);
      // Assert
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "church.update",
            actorId: "user-1",
            churchId: "church-1",
            ip: "10.0.0.1",
            userAgent: "TestRunner/1.0",
          }),
        }),
      );
    });

    it("audit log failure does not bubble up and still returns denied result", async () => {
      // Arrange
      const { db } = await import("@/lib/db");
      vi.mocked(db.auditLog.create).mockRejectedValueOnce(new Error("DB down"));
      const ctx = makeCtx(["STAFF"]);
      // Act
      const result = await can("church.update", ctx);
      // Assert — denial must still propagate despite the audit write failing
      expect(result.allowed).toBe(false);
    });
  });

  // ── CanResult shape ──────────────────────────────────────────────────
  describe("CanResult shape", () => {
    it("denied result has allowed=false and a non-empty reason string", async () => {
      const result = await can("church.update", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(false);
      expect(typeof result.reason).toBe("string");
      expect(result.reason!.length).toBeGreaterThan(0);
    });

    it("allowed result has allowed=true and no reason", async () => {
      const result = await can("church.update", makeCtx(["OWNER"]));
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("conditional allow returns a restrictions object", async () => {
      // STAFF on order.refund gets a partial-refund restriction
      const result = await can("order.refund", makeCtx(["STAFF"]));
      expect(result.allowed).toBe(true);
      expect(result.restrictions).toBeDefined();
    });

    it("unconditional allow has no restrictions", async () => {
      const result = await can("church.update", makeCtx(["OWNER"]));
      expect(result.allowed).toBe(true);
      expect(result.restrictions).toBeUndefined();
    });
  });
});
