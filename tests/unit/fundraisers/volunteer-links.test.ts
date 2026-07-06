import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  volunteerLink: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  catalog: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: { volunteerLink: mocks.volunteerLink, catalog: mocks.catalog },
}));

import {
  createVolunteerLink,
  hashToken,
  revokeVolunteerLink,
  validateVolunteerToken,
} from "@/lib/fundraisers/volunteer-links";

describe("volunteer links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createVolunteerLink", () => {
    it("stores a hash, not the raw token, and returns the raw token", async () => {
      mocks.catalog.findFirst.mockResolvedValue({
        id: "cat-1",
        churchId: "church-1",
        closesAt: new Date("2026-08-01T00:00:00Z"),
      });
      mocks.volunteerLink.create.mockResolvedValue({ id: "link-1" });

      const result = await createVolunteerLink({
        catalogId: "cat-1",
        churchId: "church-1",
        createdById: "user-1",
      });

      expect(result.token).toMatch(/^[a-f0-9]{64}$/);
      const createArg = mocks.volunteerLink.create.mock.calls[0]?.[0];
      expect(createArg.data.tokenHash).toBe(hashToken(result.token));
      expect(createArg.data.tokenHash).not.toBe(result.token);
      expect(createArg.data.expiresAt).toEqual(new Date("2026-08-01T00:00:00Z"));
    });

    it("throws when the catalog does not exist in this church", async () => {
      mocks.catalog.findFirst.mockResolvedValue(null);
      await expect(
        createVolunteerLink({ catalogId: "nope", churchId: "church-1", createdById: "user-1" }),
      ).rejects.toThrow("Catalog not found");
    });
  });

  describe("validateVolunteerToken", () => {
    const validRow = {
      id: "link-1",
      catalogId: "cat-1",
      churchId: "church-1",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      catalog: { id: "cat-1", status: "OPEN", churchId: "church-1" },
    };

    it("returns link context for a valid token", async () => {
      mocks.volunteerLink.findUnique.mockResolvedValue(validRow);
      const result = await validateVolunteerToken("a".repeat(64));
      expect(result).toEqual({ catalogId: "cat-1", churchId: "church-1", linkId: "link-1" });
      expect(mocks.volunteerLink.findUnique.mock.calls[0]?.[0].where.tokenHash).toBe(
        hashToken("a".repeat(64)),
      );
    });

    it("returns null for an unknown token", async () => {
      mocks.volunteerLink.findUnique.mockResolvedValue(null);
      expect(await validateVolunteerToken("b".repeat(64))).toBeNull();
    });

    it("returns null for a malformed token without querying", async () => {
      expect(await validateVolunteerToken("not-a-token")).toBeNull();
      expect(mocks.volunteerLink.findUnique).not.toHaveBeenCalled();
    });

    it("returns null for a 63-char hex token without querying", async () => {
      expect(await validateVolunteerToken("a".repeat(63))).toBeNull();
      expect(mocks.volunteerLink.findUnique).not.toHaveBeenCalled();
    });

    it("returns null for a 65-char hex token without querying", async () => {
      expect(await validateVolunteerToken("a".repeat(65))).toBeNull();
      expect(mocks.volunteerLink.findUnique).not.toHaveBeenCalled();
    });

    it("returns null for an uppercase hex token without querying", async () => {
      expect(await validateVolunteerToken("A".repeat(64))).toBeNull();
      expect(mocks.volunteerLink.findUnique).not.toHaveBeenCalled();
    });

    it("returns null for an expired token", async () => {
      mocks.volunteerLink.findUnique.mockResolvedValue({
        ...validRow,
        expiresAt: new Date(Date.now() - 1),
      });
      expect(await validateVolunteerToken("a".repeat(64))).toBeNull();
    });

    it("returns null for a revoked token", async () => {
      mocks.volunteerLink.findUnique.mockResolvedValue({ ...validRow, revokedAt: new Date() });
      expect(await validateVolunteerToken("a".repeat(64))).toBeNull();
    });

    it("returns null when the catalog is not OPEN", async () => {
      mocks.volunteerLink.findUnique.mockResolvedValue({
        ...validRow,
        catalog: { ...validRow.catalog, status: "CLOSED" },
      });
      expect(await validateVolunteerToken("a".repeat(64))).toBeNull();
    });
  });

  describe("revokeVolunteerLink", () => {
    it("revokes a link belonging to the church and catalog", async () => {
      mocks.volunteerLink.findFirst.mockResolvedValue({ id: "link-1" });
      mocks.volunteerLink.update.mockResolvedValue({ id: "link-1" });

      await revokeVolunteerLink("link-1", "church-1", "cat-1");

      expect(mocks.volunteerLink.findFirst.mock.calls[0]?.[0].where).toEqual({
        id: "link-1",
        churchId: "church-1",
        catalogId: "cat-1",
      });
      const updateArg = mocks.volunteerLink.update.mock.calls[0]?.[0];
      expect(updateArg.where).toEqual({ id: "link-1" });
      expect(updateArg.data.revokedAt).toBeInstanceOf(Date);
    });

    it("does not update when the link is not in this church", async () => {
      mocks.volunteerLink.findFirst.mockResolvedValue(null);

      await expect(revokeVolunteerLink("link-1", "other-church", "cat-1")).resolves.toBeUndefined();
      expect(mocks.volunteerLink.update).not.toHaveBeenCalled();
    });

    it("does not update when the link belongs to a different catalog in the same church", async () => {
      mocks.volunteerLink.findFirst.mockResolvedValue(null);

      await expect(
        revokeVolunteerLink("link-1", "church-1", "other-catalog"),
      ).resolves.toBeUndefined();
      expect(mocks.volunteerLink.update).not.toHaveBeenCalled();
    });

    it("is idempotent when the record vanishes before the update (P2025)", async () => {
      mocks.volunteerLink.findFirst.mockResolvedValue({ id: "link-1" });
      mocks.volunteerLink.update.mockRejectedValue({ code: "P2025" });

      await expect(revokeVolunteerLink("link-1", "church-1", "cat-1")).resolves.toBeUndefined();
    });

    it("rethrows infrastructure errors from the update", async () => {
      mocks.volunteerLink.findFirst.mockResolvedValue({ id: "link-1" });
      mocks.volunteerLink.update.mockRejectedValue(new Error("connection lost"));

      await expect(revokeVolunteerLink("link-1", "church-1", "cat-1")).rejects.toThrow(
        "connection lost",
      );
    });
  });
});
