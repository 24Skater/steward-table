import { describe, expect, it } from "vitest";
import { rollUpKitchenRevenue } from "@/lib/kitchens/reporting";

const kitchens = [
  { id: "k-main", name: "Main Kitchen", isDefault: true },
  { id: "k-media", name: "Media Kitchen", isDefault: false },
];

describe("rollUpKitchenRevenue", () => {
  it("sums orders and revenue per kitchen via catalog assignment", () => {
    const catalogs = [
      { id: "c1", kitchenId: "k-media" },
      { id: "c2", kitchenId: "k-main" },
    ];
    const rows = [
      { catalogId: "c1", orders: 3, revenue: 1500 },
      { catalogId: "c2", orders: 2, revenue: 800 },
    ];

    const result = rollUpKitchenRevenue(kitchens, catalogs, rows);

    expect(result).toEqual([
      { kitchenName: "Main Kitchen", orders: 2, revenue: 800 },
      { kitchenName: "Media Kitchen", orders: 3, revenue: 1500 },
    ]);
  });

  it("attributes catalogs with no kitchen to the default kitchen", () => {
    const catalogs = [{ id: "c1", kitchenId: null }];
    const rows = [{ catalogId: "c1", orders: 5, revenue: 2500 }];

    const result = rollUpKitchenRevenue(kitchens, catalogs, rows);

    expect(result).toEqual([
      { kitchenName: "Main Kitchen", orders: 5, revenue: 2500 },
      { kitchenName: "Media Kitchen", orders: 0, revenue: 0 },
    ]);
  });

  it("attributes orders for an unknown catalog to the default kitchen", () => {
    const result = rollUpKitchenRevenue(
      kitchens,
      [],
      [{ catalogId: "missing", orders: 1, revenue: 100 }],
    );

    expect(result).toEqual([
      { kitchenName: "Main Kitchen", orders: 1, revenue: 100 },
      { kitchenName: "Media Kitchen", orders: 0, revenue: 0 },
    ]);
  });

  it("returns zeroed rows for every kitchen when there is no revenue", () => {
    const result = rollUpKitchenRevenue(kitchens, [], []);
    expect(result).toEqual([
      { kitchenName: "Main Kitchen", orders: 0, revenue: 0 },
      { kitchenName: "Media Kitchen", orders: 0, revenue: 0 },
    ]);
  });
});
