import { isPlatformRequest } from "@/lib/platform/service-token";
import { checkSlugFormat } from "@/lib/platform/slug";
import { describe, expect, it } from "vitest";

const TOKEN = "stw_svc_table_1a2b3c4d5e6f7g8h";
type Env = Record<string, string | undefined>;

const ENV: Env = { PLATFORM_SERVICE_TOKEN: TOKEN };

const check = (header: string | null, env: Env = ENV) => isPlatformRequest(header, env);

describe("isPlatformRequest", () => {
  it("accepts this app's configured token", () => {
    expect(check(`Bearer ${TOKEN}`)).toBe(true);
  });

  it("accepts the scheme case-insensitively, as RFC 7235 requires", () => {
    expect(check(`bearer ${TOKEN}`)).toBe(true);
    expect(check(`BEARER ${TOKEN}`)).toBe(true);
  });

  it("rejects a missing or malformed header", () => {
    expect(check(null)).toBe(false);
    expect(check("")).toBe(false);
    expect(check(TOKEN)).toBe(false);
    expect(check("Bearer")).toBe(false);
    expect(check(`Basic ${TOKEN}`)).toBe(false);
  });

  it("rejects a token issued to a different product", () => {
    // The console mints one token per app precisely so a leak from VBS cannot
    // reach Table. A vbs-shaped token must not authenticate here even if the
    // secret half were somehow identical.
    expect(check("Bearer stw_svc_vbs_1a2b3c4d5e6f7g8h")).toBe(false);
  });

  it("rejects a prefix or an extended token", () => {
    expect(check(`Bearer ${TOKEN.slice(0, -1)}`)).toBe(false);
    expect(check(`Bearer ${TOKEN}x`)).toBe(false);
  });

  it("refuses every request when no token is configured", () => {
    // An app deployed without PLATFORM_SERVICE_TOKEN must refuse platform
    // calls, not accept them and not crash on them.
    expect(check(`Bearer ${TOKEN}`, {})).toBe(false);
    expect(check(`Bearer ${TOKEN}`, { PLATFORM_SERVICE_TOKEN: "" })).toBe(false);
  });

  it("refuses a configured token that is not shaped like this app's", () => {
    // Guards against pasting the console's chms token into Table's environment,
    // which would otherwise authenticate anything holding that same string.
    expect(check("Bearer stw_svc_chms_x", { PLATFORM_SERVICE_TOKEN: "stw_svc_chms_x" })).toBe(
      false,
    );
  });
});

describe("checkSlugFormat", () => {
  it("accepts ordinary slugs", () => {
    for (const slug of ["grace", "first-baptist", "st-marys-2026"]) {
      expect(checkSlugFormat(slug), slug).toBe(true);
    }
  });

  it("rejects shapes that are not valid DNS labels", () => {
    for (const slug of [
      "a",
      "1st",
      "grace-",
      "gra--ce",
      "first_baptist",
      "Grace",
      "a".repeat(32),
    ]) {
      expect(checkSlugFormat(slug), slug).toBe(false);
    }
  });
});
