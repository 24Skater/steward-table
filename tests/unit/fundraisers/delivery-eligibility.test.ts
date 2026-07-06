import { isDeliveryEligible } from "@/lib/fundraisers/delivery-eligibility";
import { describe, expect, it } from "vitest";

describe("isDeliveryEligible", () => {
  it("returns true when no rule is set (null)", () => {
    expect(isDeliveryEligible(1, null)).toBe(true);
  });
  it("returns true when no rule is set (undefined)", () => {
    expect(isDeliveryEligible(1, undefined)).toBe(true);
  });
  it("returns true when item count meets the minimum", () => {
    expect(isDeliveryEligible(3, 3)).toBe(true);
  });
  it("returns true when item count exceeds the minimum", () => {
    expect(isDeliveryEligible(5, 3)).toBe(true);
  });
  it("returns false when item count is below the minimum", () => {
    expect(isDeliveryEligible(2, 3)).toBe(false);
  });
  it("returns false for an empty cart when a rule exists", () => {
    expect(isDeliveryEligible(0, 1)).toBe(false);
  });
  it("treats a zero/negative rule as no rule", () => {
    expect(isDeliveryEligible(0, 0)).toBe(true);
    expect(isDeliveryEligible(0, -2)).toBe(true);
  });
});
