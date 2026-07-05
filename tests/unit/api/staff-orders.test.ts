import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  can: vi.fn(),
  createStorefrontOrder: vi.fn(),
  catalog: {
    findUnique: vi.fn(),
  },
  church: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/rbac/can", () => ({
  can: mocks.can,
}));

vi.mock("@/lib/orders/create-storefront-order", () => ({
  createStorefrontOrder: mocks.createStorefrontOrder,
}));

vi.mock("@/lib/db", () => ({
  db: { catalog: mocks.catalog, church: mocks.church },
}));

import { POST } from "@/app/api/fundraisers/[catalogId]/orders/route";

const CATALOG_ID = "cat-1";

const validSession = {
  user: {
    id: "user-1",
    memberships: [{ id: "m-1", churchId: "church-1", roles: ["STAFF"], status: "ACTIVE" }],
  },
};

const validBody = {
  customerName: "John Doe",
  phone: "555-1234",
  clientRequestId: "req-1",
  items: [
    {
      itemId: "item-1",
      catalogId: CATALOG_ID,
      itemName: "Tamales",
      quantity: 2,
      basePrice: 500,
      modifiers: [],
      totalPrice: 1000,
    },
  ],
};

function makeRequest(body: unknown): NextRequest {
  return new Request(`http://localhost/api/fundraisers/${CATALOG_ID}/orders`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as unknown as NextRequest;
}

const routeParams = () => ({ params: Promise.resolve({ catalogId: CATALOG_ID }) });

describe("POST /api/fundraisers/[catalogId]/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(validSession);
    mocks.can.mockResolvedValue({ allowed: true });
    mocks.catalog.findUnique.mockResolvedValue({ id: CATALOG_ID, churchId: "church-1" });
    mocks.church.findUnique.mockResolvedValue({ currency: "USD" });
    mocks.createStorefrontOrder.mockResolvedValue({
      ok: true,
      orderId: "order-1",
      orderNumber: 7,
      deduplicated: false,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.auth.mockResolvedValue(null);

    const res = await POST(makeRequest(validBody), routeParams());

    expect(res.status).toBe(401);
    expect(mocks.createStorefrontOrder).not.toHaveBeenCalled();
  });

  it("returns 403 when the user's membership belongs to a different church than the catalog", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
        memberships: [{ id: "m-2", churchId: "church-2", roles: ["STAFF"], status: "ACTIVE" }],
      },
    });

    const res = await POST(makeRequest(validBody), routeParams());

    expect(res.status).toBe(403);
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.createStorefrontOrder).not.toHaveBeenCalled();
  });

  it("returns 400 when an item's catalogId does not match the URL catalog", async () => {
    const body = {
      ...validBody,
      items: [{ ...validBody.items[0]!, catalogId: "other-catalog" }],
    };

    const res = await POST(makeRequest(body), routeParams());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Items do not match this fundraiser" });
    expect(mocks.createStorefrontOrder).not.toHaveBeenCalled();
  });

  it("creates an order and returns 201 with takenById and no takenByName", async () => {
    const res = await POST(makeRequest(validBody), routeParams());

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      orderId: "order-1",
      orderNumber: 7,
      deduplicated: false,
    });

    const serviceArg = mocks.createStorefrontOrder.mock.calls[0]![0];
    expect(serviceArg.channel).toBe("VOLUNTEER");
    expect(serviceArg.takenById).toBe("user-1");
    expect(serviceArg.takenByName).toBeUndefined();
    expect(serviceArg.churchId).toBe("church-1");
    expect(serviceArg.clientRequestId).toBe("req-1");
  });
});
