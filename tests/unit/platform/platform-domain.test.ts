import {
  appHost,
  defaultSenderAddress,
  extractTenantSlug,
  storefrontUrl,
  tenantHost,
} from "@/lib/platform-domain";
import { describe, expect, it } from "vitest";

const PROD = "example.org";
const DEV = "localhost:3000";

describe("platform domain - production root", () => {
  it("serves the admin app from the app subdomain", () => {
    expect(appHost(PROD)).toBe("table.example.org");
  });

  it("builds a tenant host under the app host", () => {
    expect(tenantHost("grace", PROD)).toBe("grace.table.example.org");
  });

  it("builds an https storefront URL", () => {
    expect(storefrontUrl("grace", PROD)).toBe("https://grace.table.example.org");
  });

  it("derives sender addresses from the root", () => {
    expect(defaultSenderAddress("orders", PROD)).toBe("orders@table.example.org");
  });
});

describe("platform domain - local development root", () => {
  it("collapses the app host to the bare root", () => {
    expect(appHost(DEV)).toBe(DEV);
  });

  it("falls back to a path-prefixed storefront URL", () => {
    expect(storefrontUrl("grace", DEV)).toBe("http://localhost:3000/grace");
  });

  it("strips the port from sender addresses", () => {
    expect(defaultSenderAddress("noreply", DEV)).toBe("noreply@localhost");
  });
});

describe("extractTenantSlug", () => {
  it("reads the slug from a production tenant host", () => {
    expect(extractTenantSlug("grace.table.example.org", PROD)).toBe("grace");
  });

  it("is case-insensitive", () => {
    expect(extractTenantSlug("Grace.Table.Example.Org", PROD)).toBe("grace");
  });

  it("returns null for the bare app host, where the slug is in the path", () => {
    expect(extractTenantSlug("table.example.org", PROD)).toBeNull();
  });

  it("returns null for an unrelated host", () => {
    expect(extractTenantSlug("grace.table.evil.test", PROD)).toBeNull();
  });

  it("rejects a nested subdomain rather than reading a dotted slug", () => {
    expect(extractTenantSlug("a.b.table.example.org", PROD)).toBeNull();
  });

  it("handles a missing Host header", () => {
    expect(extractTenantSlug(null, PROD)).toBeNull();
  });

  it("reads a local /etc/hosts style subdomain", () => {
    expect(extractTenantSlug("grace.localhost:3000", DEV)).toBe("grace");
  });
});
