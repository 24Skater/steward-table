import {
  checkEntitlement,
  isMutationMethod,
  platformClient,
  resetPlatformClient,
} from "@/lib/platform/entitlements";
import type { PlatformClient } from "@steward-apps/platform-client";
import { afterEach, describe, expect, it, vi } from "vitest";

const ORG_ID = "0a4c2b8e-5f1d-4a2b-9c3e-7d8f1a2b3c4d";

const CONFIGURED = {
  PLATFORM_CONSOLE_URL: "https://console.example.org",
  PLATFORM_SERVICE_TOKEN: "stw_svc_table_secret",
};

/** A client stub that answers with one state, or throws. */
function stubClient(answer: string | undefined | Error): PlatformClient {
  return {
    getState: async () => {
      if (answer instanceof Error) throw answer;
      return answer;
    },
  } as unknown as PlatformClient;
}

afterEach(() => {
  resetPlatformClient(undefined);
  vi.restoreAllMocks();
});

describe("self-hosted deployments", () => {
  it("allows everything when the platform is not configured", async () => {
    resetPlatformClient(null);

    const read = await checkEntitlement(ORG_ID, false, {});
    const write = await checkEntitlement(ORG_ID, true, {});

    // Table is AGPL and self-hostable. A church running its own copy has no
    // console to ask and must not be blocked by one.
    expect(read).toEqual({ allow: true, state: null, readOnly: false });
    expect(write).toEqual({ allow: true, state: null, readOnly: false });
  });

  it("builds no client when either half of the configuration is missing", () => {
    resetPlatformClient(undefined);
    expect(platformClient({ PLATFORM_CONSOLE_URL: "https://c" })).toBeNull();

    resetPlatformClient(undefined);
    expect(platformClient({ PLATFORM_SERVICE_TOKEN: "t" })).toBeNull();
  });

  it("builds a client when both halves are present, and reuses it", () => {
    resetPlatformClient(undefined);
    const first = platformClient(CONFIGURED);
    const second = platformClient(CONFIGURED);

    expect(first).not.toBeNull();
    // One client, so the 60s snapshot cache and 24h JWKS cache actually apply.
    expect(second).toBe(first);
  });
});

describe("entitlement states", () => {
  it("allows reads and writes when ACTIVE", async () => {
    resetPlatformClient(stubClient("ACTIVE"));

    expect(await checkEntitlement(ORG_ID, false)).toEqual({
      allow: true,
      state: "ACTIVE",
      readOnly: false,
    });
    expect(await checkEntitlement(ORG_ID, true)).toMatchObject({ allow: true });
  });

  it("allows writes during GRACE, because retries are still in flight", async () => {
    resetPlatformClient(stubClient("GRACE"));

    expect(await checkEntitlement(ORG_ID, true)).toEqual({
      allow: true,
      state: "GRACE",
      readOnly: false,
    });
  });

  it("allows reads but blocks writes when READ_ONLY", async () => {
    resetPlatformClient(stubClient("READ_ONLY"));

    // The whole point of READ_ONLY: a lapsed church can still log in and export.
    expect(await checkEntitlement(ORG_ID, false)).toEqual({
      allow: true,
      state: "READ_ONLY",
      readOnly: true,
    });
    expect(await checkEntitlement(ORG_ID, true)).toEqual({
      allow: false,
      reason: "read_only",
      state: "READ_ONLY",
    });
  });

  it("blocks everything when REVOKED", async () => {
    resetPlatformClient(stubClient("REVOKED"));

    expect(await checkEntitlement(ORG_ID, false)).toMatchObject({
      allow: false,
      reason: "revoked",
    });
    expect(await checkEntitlement(ORG_ID, true)).toMatchObject({
      allow: false,
      reason: "revoked",
    });
  });

  it("distinguishes never-subscribed from revoked", async () => {
    resetPlatformClient(stubClient(undefined));

    // An org that never bought Table is absent from the token, not REVOKED.
    // The two need different messages: one is a sales page, the other billing.
    expect(await checkEntitlement(ORG_ID, false)).toEqual({
      allow: false,
      reason: "not_subscribed",
      state: null,
    });
  });
});

describe("console outages", () => {
  it("allows the request when the client has no entitlement at all", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    resetPlatformClient(stubClient(new Error("PlatformUnavailableError")));

    // The client already fails open for 24h against its cache and throws only
    // when it has never seen this org. Refusing here would lock out a church
    // whose first request of the day landed during an outage.
    expect(await checkEntitlement(ORG_ID, true)).toEqual({
      allow: true,
      state: null,
      readOnly: false,
    });
  });

  it("logs when it allows a request it could not verify", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    resetPlatformClient(stubClient(new Error("boom")));

    await checkEntitlement(ORG_ID, false);

    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain("allowing the request");
  });
});

describe("isMutationMethod", () => {
  it("treats GET, HEAD and OPTIONS as safe", () => {
    for (const method of ["GET", "HEAD", "OPTIONS", "get", "head"]) {
      expect(isMutationMethod(method), method).toBe(false);
    }
  });

  it("treats everything else as a mutation", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "post"]) {
      expect(isMutationMethod(method), method).toBe(true);
    }
  });
});
