import { describe, expect, it, vi } from "vitest";
import { buildKitchenOrderWhere, getKitchenCatalogIds } from "@/lib/kitchens/scope";

function makeDb(rows: Array<{ id: string }>) {
  return {
    catalog: { findMany: vi.fn().mockResolvedValue(rows) },
  } as never;
}

describe("getKitchenCatalogIds", () => {
  it("for a non-default kitchen, filters catalogs by kitchenId only", async () => {
    // Arrange
    const db = makeDb([{ id: "c1" }, { id: "c2" }]);
    const kitchen = { id: "k1", isDefault: false };

    // Act
    const ids = await getKitchenCatalogIds(db, "church-1", kitchen);

    // Assert
    expect(ids).toEqual(["c1", "c2"]);
    expect((db as never as { catalog: { findMany: ReturnType<typeof vi.fn> } }).catalog.findMany)
      .toHaveBeenCalledWith({
        where: { churchId: "church-1", kitchenId: "k1" },
        select: { id: true },
      });
  });

  it("for the default kitchen, also includes catalogs with kitchenId null", async () => {
    // Arrange
    const db = makeDb([{ id: "c1" }]);
    const kitchen = { id: "k-default", isDefault: true };

    // Act
    await getKitchenCatalogIds(db, "church-1", kitchen);

    // Assert
    expect((db as never as { catalog: { findMany: ReturnType<typeof vi.fn> } }).catalog.findMany)
      .toHaveBeenCalledWith({
        where: {
          churchId: "church-1",
          OR: [{ kitchenId: "k-default" }, { kitchenId: null }],
        },
        select: { id: true },
      });
  });
});

describe("buildKitchenOrderWhere", () => {
  it("scopes by church, status, and catalog ids", () => {
    const where = buildKitchenOrderWhere("church-1", ["c1", "c2"], ["CONFIRMED", "IN_KITCHEN"]);
    expect(where).toEqual({
      churchId: "church-1",
      status: { in: ["CONFIRMED", "IN_KITCHEN"] },
      catalogId: { in: ["c1", "c2"] },
    });
  });

  it("an empty catalog list matches nothing (catalogId in [])", () => {
    const where = buildKitchenOrderWhere("church-1", [], ["CONFIRMED"]);
    expect(where.catalogId).toEqual({ in: [] });
  });
});
