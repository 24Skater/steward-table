import { gateFor, isStaticAsset } from "@/lib/platform/request-gate";
import { describe, expect, it } from "vitest";

describe("paths the middleware hands straight back", () => {
  it("bypasses Next.js internals", () => {
    expect(gateFor("/_next/static/chunk.js").gate).toBe("bypass");
  });

  it("bypasses the sign-in routes", () => {
    // Auth.js endpoints and the sign-in / error / verify pages both live under
    // /auth (see basePath in lib/auth/config.ts). Gating them would mean a
    // lapsed church could not sign in to pay.
    expect(gateFor("/auth/sign-in").gate).toBe("bypass");
    expect(gateFor("/auth/callback/credentials").gate).toBe("bypass");
  });

  it("bypasses the billing page", () => {
    // The entitlement redirect points here. Gating it loops, and rewriting it
    // under a church's slug would 404 the page it redirects to.
    expect(gateFor("/billing/required").gate).toBe("bypass");
  });

  it("bypasses the console's own provisioning call", () => {
    // Authenticated by service token, not by session, and it is how a church
    // that failed to provision gets un-stuck. Refusing it because the church
    // is not entitled would make the un-sticking depend on being un-stuck.
    expect(gateFor("/api/internal/provision").gate).toBe("bypass");
  });

  it("bypasses scheduled jobs", () => {
    // A cron caller carries no session, so there is no org to check against.
    expect(gateFor("/api/cron/no-show-sweep").gate).toBe("bypass");
  });
});

describe("the public storefront", () => {
  it("is not gated, but is still a normal request", () => {
    // "none" rather than "bypass": these paths are rewritten under the church's
    // slug on a tenant host, so the middleware has to keep handling them.
    expect(gateFor("/").gate).toBe("none");
    expect(gateFor("/grace-fellowship/menu").gate).toBe("none");
  });
});

describe("dashboard pages", () => {
  it("requires a session on every staff surface", () => {
    for (const path of [
      "/orders",
      "/kitchen",
      "/catalog",
      "/customers",
      "/inventory",
      "/drivers",
      "/settings",
      "/reports",
    ]) {
      expect(gateFor(path).gate, path).toBe("session-required");
    }
  });

  it("covers nested pages, not just the root of each section", () => {
    expect(gateFor("/orders/1001").gate).toBe("session-required");
    expect(gateFor("/settings/integrations").gate).toBe("session-required");
  });

  it("does not treat a merely similar prefix as a dashboard page", () => {
    // /ordersomething is not /orders. Prefix matching without a segment
    // boundary would gate a storefront path that happens to start with the
    // same letters.
    expect(gateFor("/ordersomething").gate).toBe("none");
  });

  it("does not treat a merely similar prefix as exempt", () => {
    // The same boundary in the other direction, which is the dangerous one:
    // a future /api/internals must not inherit /api/internal's exemption.
    expect(gateFor("/api/internals").gate).toBe("session-optional");
  });
});

describe("API routes", () => {
  it("gates every API route that is not explicitly exempt", () => {
    // The regression this exists to prevent: entitlement enforcement used to
    // run only for the dashboard page prefixes, so all 88 API routes were
    // reachable while an organization was READ_ONLY or REVOKED - including the
    // ones the dashboard itself calls to write.
    for (const path of [
      "/api/ministries",
      "/api/orders",
      "/api/catalogs",
      "/api/customers",
      "/api/menu/items/abc",
      "/api/inventory/xyz",
    ]) {
      expect(gateFor(path).gate, path).toBe("session-optional");
    }
  });

  it("gates an API route without demanding a session", () => {
    // Anonymous storefront traffic must keep flowing: a church that has lapsed
    // still has customers mid-order, and cutting them off punishes the wrong
    // people. Each route does its own authentication; the gate only has an
    // organization to check when the caller is signed in.
    expect(gateFor("/api/orders")).toEqual({ gate: "session-optional" });
  });
});

describe("static assets", () => {
  it("recognises a file by the dot in its last segment", () => {
    expect(isStaticAsset("/logo.png")).toBe(true);
    expect(isStaticAsset("/_next/static/chunk.js")).toBe(true);
  });

  it("does not treat a dotted path segment as a file", () => {
    expect(isStaticAsset("/grace.fellowship/menu")).toBe(false);
  });

  it("never treats an API route as a file", () => {
    // A route parameter is free to contain a dot. Calling that a static asset
    // would hand an ungated request straight through the gate.
    expect(isStaticAsset("/api/items/a.b")).toBe(false);
    expect(isStaticAsset("/api/customers/export.csv")).toBe(false);
  });
});
