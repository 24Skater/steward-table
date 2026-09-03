import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  church: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: { church: mocks.church } }));

import { POST } from "@/app/api/internal/provision/route";

const TOKEN = "stw_svc_table_1a2b3c4d5e6f";
const ORG_ID = "0a4c2b8e-5f1d-4a2b-9c3e-7d8f1a2b3c4d";

const VALID_BODY = {
  orgId: ORG_ID,
  slug: "grace",
  organizationName: "Grace Chapel",
  ownerEmail: "pastor@example.org",
};

function request(body: unknown, token: string | null = TOKEN): NextRequest {
  return {
    headers: {
      get: (name: string) => (name === "authorization" && token ? `Bearer ${token}` : null),
    },
    json: async () => {
      if (body === undefined) throw new Error("bad json");
      return body;
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PLATFORM_SERVICE_TOKEN = TOKEN;
  // No church exists unless a test says otherwise.
  mocks.church.findUnique.mockResolvedValue(null);
  mocks.church.create.mockResolvedValue({ id: ORG_ID });
});

describe("authentication", () => {
  it("rejects a request with no token", async () => {
    const response = await POST(request(VALID_BODY, null));
    expect(response.status).toBe(401);
    expect(mocks.church.create).not.toHaveBeenCalled();
  });

  it("rejects a wrong token", async () => {
    const response = await POST(request(VALID_BODY, "stw_svc_table_wrong"));
    expect(response.status).toBe(401);
    expect(mocks.church.create).not.toHaveBeenCalled();
  });

  it("checks the token before reading the body", async () => {
    // An unauthenticated caller should not be able to make this app parse
    // arbitrary JSON, however cheap that is.
    const response = await POST(request(undefined, null));
    expect(response.status).toBe(401);
  });
});

describe("validation", () => {
  it("rejects malformed JSON", async () => {
    const response = await POST(request(undefined));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_json" });
  });

  it("requires orgId to be a UUID, because the console mints UUIDs", async () => {
    const response = await POST(request({ ...VALID_BODY, orgId: "church-1" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_request" });
  });

  it("rejects a slug that is not a usable DNS label", async () => {
    for (const slug of ["grace-", "gra--ce", "1st"]) {
      const response = await POST(request({ ...VALID_BODY, slug }));
      expect(response.status, slug).toBe(400);
    }
  });

  it("requires an organization name", async () => {
    const response = await POST(request({ ...VALID_BODY, organizationName: "" }));
    expect(response.status).toBe(400);
  });

  it("treats ownerEmail as optional", async () => {
    const { ownerEmail: _omitted, ...withoutEmail } = VALID_BODY;
    const response = await POST(request(withoutEmail));
    expect(response.status).toBe(201);
  });
});

describe("provisioning", () => {
  it("creates the Church with id equal to the console's orgId", async () => {
    const response = await POST(request(VALID_BODY));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ state: "ready", churchId: ORG_ID, created: true });

    // The whole platform depends on this: one organization, one id, across all
    // four apps. Not a mapping table - the same value.
    expect(mocks.church.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: ORG_ID, slug: "grace", name: "Grace Chapel" }),
      }),
    );
  });

  it("creates a settings row so the app is usable immediately", async () => {
    await POST(request(VALID_BODY));

    expect(mocks.church.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ settings: { create: {} } }) }),
    );
  });

  it("normalizes the slug before storing it", async () => {
    await POST(request({ ...VALID_BODY, slug: "  Grace  " }));
    expect(mocks.church.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: "grace" }) }),
    );
  });
});

describe("idempotency", () => {
  it("reports ready without creating when the org already exists", async () => {
    mocks.church.findUnique.mockResolvedValueOnce({ id: ORG_ID, slug: "grace" });

    const response = await POST(request(VALID_BODY));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "ready", churchId: ORG_ID, created: false });
    expect(mocks.church.create).not.toHaveBeenCalled();
  });

  it("does not rename an existing church on retry", async () => {
    // The console retries after a response it never received. By then the owner
    // may have renamed the church themselves; a retry must not undo that.
    mocks.church.findUnique.mockResolvedValueOnce({ id: ORG_ID, slug: "renamed-by-owner" });

    const response = await POST(request({ ...VALID_BODY, organizationName: "Old Name" }));

    expect(response.status).toBe(200);
    expect(mocks.church.create).not.toHaveBeenCalled();
  });
});

describe("slug collisions", () => {
  it("returns 409 when a different church already holds the slug", async () => {
    mocks.church.findUnique
      .mockResolvedValueOnce(null) // no church with this orgId
      .mockResolvedValueOnce({ id: "some-other-church" }); // but the slug is taken

    const response = await POST(request(VALID_BODY));

    // 409 and not 500 on purpose: the console's classifier fails fast on any
    // 4xx other than 429, so this surfaces to the operator instead of being
    // retried five times into the same wall.
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ state: "failed", error: "slug_taken" });
    expect(mocks.church.create).not.toHaveBeenCalled();
  });
});
