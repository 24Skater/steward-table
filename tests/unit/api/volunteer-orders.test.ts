import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validateVolunteerToken: vi.fn(),
  createStorefrontOrder: vi.fn(),
  church: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/fundraisers/volunteer-links", () => ({
  validateVolunteerToken: mocks.validateVolunteerToken,
}));

vi.mock("@/lib/orders/create-storefront-order", () => ({
  createStorefrontOrder: mocks.createStorefrontOrder,
}));

vi.mock("@/lib/db", () => ({
  db: { church: mocks.church },
}));

import { POST } from "@/app/api/v/[token]/orders/route";

const TOKEN = "a".repeat(64);

const validLink = { catalogId: "cat-1", churchId: "church-1", linkId: "link-1" };

const validBody = {
  volunteerName: "  Sister Maria  ",
  customerName: "John Doe",
  phone: "555-1234",
  clientRequestId: "req-1",
  items: [
    {
      itemId: "item-1",
      catalogId: "cat-1",
      itemName: "Tamales",
      quantity: 2,
      basePrice: 500,
      modifiers: [],
      totalPrice: 1000,
    },
  ],
};

function makeRequest(body: unknown): NextRequest {
  return new Request(`http://localhost/api/v/${TOKEN}/orders`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as unknown as NextRequest;
}

const routeParams = () => ({ params: Promise.resolve({ token: TOKEN }) });

describe("POST /api/v/[token]/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateVolunteerToken.mockResolvedValue(validLink);
    mocks.church.findUnique.mockResolvedValue({ currency: "USD" });
    mocks.createStorefrontOrder.mockResolvedValue({
      ok: true,
      orderId: "order-1",
      orderNumber: 42,
      deduplicated: false,
    });
  });

  it("returns 404 for an invalid token without touching the order service", async () => {
    mocks.validateVolunteerToken.mockResolvedValue(null);

    const res = await POST(makeRequest(validBody), routeParams());

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Invalid or expired link" });
    expect(mocks.createStorefrontOrder).not.toHaveBeenCalled();
    expect(mocks.church.findUnique).not.toHaveBeenCalled();
  });

  it("returns 400 when volunteerName is missing", async () => {
    const { volunteerName: _omit, ...body } = validBody;

    const res = await POST(makeRequest(body), routeParams());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Missing required fields" });
    expect(mocks.createStorefrontOrder).not.toHaveBeenCalled();
  });

  it("returns 400 when clientRequestId is missing", async () => {
    const { clientRequestId: _omit, ...body } = validBody;

    const res = await POST(makeRequest(body), routeParams());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Missing required fields" });
    expect(mocks.createStorefrontOrder).not.toHaveBeenCalled();
  });

  it("returns 400 when an item's catalogId does not match the link's catalog", async () => {
    const body = {
      ...validBody,
      items: [{ ...validBody.items[0]!, catalogId: "other-catalog" }],
    };

    const res = await POST(makeRequest(body), routeParams());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Items do not match this fundraiser" });
    expect(mocks.createStorefrontOrder).not.toHaveBeenCalled();
  });

  it("creates an order and returns 201 on the happy path", async () => {
    const res = await POST(makeRequest(validBody), routeParams());

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      orderId: "order-1",
      orderNumber: 42,
      deduplicated: false,
    });

    const serviceArg = mocks.createStorefrontOrder.mock.calls[0]![0];
    expect(serviceArg.channel).toBe("VOLUNTEER");
    expect(serviceArg.takenByName).toBe("Sister Maria");
    expect(serviceArg.clientRequestId).toBe("req-1");
    expect(serviceArg.churchId).toBe("church-1");
    expect(serviceArg.currency).toBe("USD");
    expect(serviceArg.takenById).toBeUndefined();
  });

  it("returns 200 when the service reports a deduplicated order", async () => {
    mocks.createStorefrontOrder.mockResolvedValue({
      ok: true,
      orderId: "order-1",
      orderNumber: 42,
      deduplicated: true,
    });

    const res = await POST(makeRequest(validBody), routeParams());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      orderId: "order-1",
      orderNumber: 42,
      deduplicated: true,
    });
  });

  it("passes through service failures with their status", async () => {
    mocks.createStorefrontOrder.mockResolvedValue({
      ok: false,
      status: 409,
      error: "This catalog is no longer accepting orders",
    });

    const res = await POST(makeRequest(validBody), routeParams());

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "This catalog is no longer accepting orders" });
  });
});
