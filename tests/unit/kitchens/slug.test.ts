import { generateUniqueKitchenSlug, slugifyKitchenName } from "@/lib/kitchens/slug";
import { describe, expect, it } from "vitest";

describe("slugifyKitchenName", () => {
  it("lowercases and hyphenates a multi-word name", () => {
    expect(slugifyKitchenName("Main Kitchen")).toBe("main-kitchen");
  });

  it("strips punctuation and collapses whitespace", () => {
    expect(slugifyKitchenName("  Media!! Team's  Kitchen ")).toBe("media-teams-kitchen");
  });

  it("falls back to 'kitchen' when the name has no usable characters", () => {
    expect(slugifyKitchenName("!!!")).toBe("kitchen");
  });

  it("normalizes accented characters to ASCII", () => {
    expect(slugifyKitchenName("Café Kitchen")).toBe("cafe-kitchen");
  });
});

describe("generateUniqueKitchenSlug", () => {
  it("returns the base slug when there is no collision", () => {
    expect(generateUniqueKitchenSlug("Side Kitchen", [])).toBe("side-kitchen");
  });

  it("suffixes -2 on first collision", () => {
    expect(generateUniqueKitchenSlug("Main Kitchen", ["main-kitchen"])).toBe("main-kitchen-2");
  });

  it("increments the suffix past existing numbered slugs", () => {
    expect(generateUniqueKitchenSlug("Main Kitchen", ["main-kitchen", "main-kitchen-2"])).toBe(
      "main-kitchen-3",
    );
  });
});
