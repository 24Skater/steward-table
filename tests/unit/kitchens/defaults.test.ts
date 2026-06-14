import {
  DEFAULT_KITCHEN_NAME,
  DEFAULT_KITCHEN_SLUG,
  createDefaultKitchen,
} from "@/lib/kitchens/defaults";
import { describe, expect, it, vi } from "vitest";

describe("createDefaultKitchen", () => {
  it("creates a kitchen named 'Main Kitchen' with slug 'main' and isDefault true", async () => {
    // Arrange
    const create = vi.fn().mockResolvedValue({ id: "k1" });
    const tx = { kitchen: { create } } as never;

    // Act
    await createDefaultKitchen(tx, "church-1");

    // Assert
    expect(create).toHaveBeenCalledWith({
      data: {
        churchId: "church-1",
        name: DEFAULT_KITCHEN_NAME,
        slug: DEFAULT_KITCHEN_SLUG,
        isDefault: true,
      },
    });
  });

  it("returns the created kitchen", async () => {
    const create = vi.fn().mockResolvedValue({ id: "k1", slug: "main" });
    const tx = { kitchen: { create } } as never;
    const result = await createDefaultKitchen(tx, "church-1");
    expect(result).toEqual({ id: "k1", slug: "main" });
  });

  it("exposes the expected constant values", () => {
    expect(DEFAULT_KITCHEN_NAME).toBe("Main Kitchen");
    expect(DEFAULT_KITCHEN_SLUG).toBe("main");
  });
});
