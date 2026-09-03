/**
 * POST /api/internal/provision
 *
 * Called by the Steward console when an organization signs up for Table. It
 * creates this app's tenant root and nothing else — the console owns identity,
 * billing and entitlements, and this app owns its own schema.
 *
 * Two properties the console depends on:
 *
 * 1. **`Church.id` is the console's `orgId`.** Not a mapping table, not a
 *    foreign key — the same value. One organization has one id across all four
 *    Steward apps, forever, and it is minted by the console.
 * 2. **Idempotent by `orgId`.** The console retries with backoff, so a second
 *    call for an org that already exists must succeed and change nothing. That
 *    is what makes retrying safe rather than merely tolerable.
 *
 * There is deliberately no DNS or certificate work here. The wildcard record
 * and wildcard certificate already resolve the tenant host for this product.
 */

import { db } from "@/lib/db";
import { isPlatformRequest } from "@/lib/platform/service-token";
import { checkSlugFormat } from "@/lib/platform/slug";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const provisionSchema = z.object({
  orgId: z.string().uuid(),
  slug: z.string().min(2).max(31),
  organizationName: z.string().min(1).max(200),
  ownerEmail: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  if (!isPlatformRequest(req.headers.get("authorization"))) {
    return NextResponse.json({ state: "failed", error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ state: "failed", error: "invalid_json" }, { status: 400 });
  }

  const parsed = provisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { state: "failed", error: "invalid_request", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const { orgId, organizationName } = parsed.data;
  const slug = parsed.data.slug.trim().toLowerCase();

  if (!checkSlugFormat(slug)) {
    return NextResponse.json({ state: "failed", error: "invalid_slug" }, { status: 400 });
  }

  // Church is a global model, so the tenancy guard does not require a churchId
  // here — this is the call that brings the tenant into existence.
  const existing = await db.church.findUnique({
    where: { id: orgId },
    select: { id: true, slug: true },
  });

  if (existing) {
    // Already provisioned. Report ready without touching anything: the console
    // may be retrying after a response it never received, and a retry must not
    // rename a church somebody has since renamed themselves.
    return NextResponse.json({ state: "ready", churchId: existing.id, created: false });
  }

  const slugOwner = await db.church.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (slugOwner) {
    // 409, not 500: a permanent condition the console must not retry into.
    // Its classifier fails fast on any 4xx other than 429, which surfaces the
    // collision to the operator instead of burning the retry budget.
    return NextResponse.json(
      { state: "failed", error: "slug_taken", detail: `The slug "${slug}" is already in use.` },
      { status: 409 },
    );
  }

  const church = await db.church.create({
    data: {
      id: orgId,
      slug,
      name: organizationName,
      // A settings row from the start, so every settings page renders real
      // defaults rather than having to cope with null on first load.
      settings: { create: {} },
    },
    select: { id: true },
  });

  return NextResponse.json({ state: "ready", churchId: church.id, created: true }, { status: 201 });
}
