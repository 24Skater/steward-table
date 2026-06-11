import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { TopBar } from "@/components/layout/top-bar";
import { SettingsPage } from "@/components/settings";
import { StorefrontShareCard } from "@/components/settings/storefront-share-card";
import type { SessionMembership } from "@/lib/auth/types";

function parseFulfillmentPrefs(brandTokens: unknown) {
  if (!brandTokens || typeof brandTokens !== "object") {
    return {
      pickupEnabled: true,
      deliveryEnabled: false,
      dineInEnabled: false,
      deliveryRadiusMiles: null,
      pickupInstructions: null,
    };
  }
  const raw = brandTokens as Record<string, unknown>;
  return {
    pickupEnabled: typeof raw.pickupEnabled === "boolean" ? raw.pickupEnabled : true,
    deliveryEnabled: typeof raw.deliveryEnabled === "boolean" ? raw.deliveryEnabled : false,
    dineInEnabled: typeof raw.dineInEnabled === "boolean" ? raw.dineInEnabled : false,
    deliveryRadiusMiles:
      typeof raw.deliveryRadiusMiles === "number" ? raw.deliveryRadiusMiles : null,
    pickupInstructions:
      typeof raw.pickupInstructions === "string" ? raw.pickupInstructions : null,
  };
}

export default async function SettingsRoute() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const result = await can("church.update", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) redirect("/");

  const [church, stripeKey, webhookKey] = await Promise.all([
    (db.church.findUnique as Function)({
      where: { id: membership.churchId },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        settings: {
          select: {
            stripeMode: true,
            replyToEmail: true,
            brandTokens: true,
          },
        },
      },
      _bypassTenancyCheck: true,
    }),
    (db.apiKey.findFirst as Function)({
      where: { churchId: membership.churchId, provider: "stripe", isLive: true },
      select: { id: true },
      _bypassTenancyCheck: true,
    }),
    (db.apiKey.findFirst as Function)({
      where: { churchId: membership.churchId, provider: "stripe_webhook", isLive: true },
      select: { id: true },
      _bypassTenancyCheck: true,
    }),
  ]);

  if (!church) redirect("/auth/sign-in");

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? `https://${church.slug}.stewardtable.com`;
  const webhookUrl = `${appUrl}/api/webhooks/stripe`;

  const isLocalDev = appUrl.includes("localhost");
  const storefrontUrl = isLocalDev
    ? `${appUrl}/${church.slug}`
    : `https://${church.slug}.table.steward.app`;

  const fulfillment = parseFulfillmentPrefs(church.settings?.brandTokens);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Settings" />
      <div className="flex-1 overflow-y-auto p-6">
        <SettingsPage
          church={{
            name: church.name,
            timezone: church.timezone,
            contactEmail: church.settings?.replyToEmail ?? null,
          }}
          payments={{
            stripeMode: church.settings?.stripeMode ?? "BYO",
            hasStripeKey: !!stripeKey,
            hasWebhookSecret: !!webhookKey,
            webhookUrl,
          }}
          fulfillment={fulfillment}
        />
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Share storefront</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Share this link so customers can browse and place orders.
            </p>
          </div>
          <StorefrontShareCard url={storefrontUrl} />
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200 flex flex-col gap-2">
          <Link
            href="/settings/delivery"
            className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
          >
            Manage delivery zones →
          </Link>
          <Link
            href="/settings/webhooks"
            className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
          >
            View webhook events →
          </Link>
          <Link
            href="/settings/audit"
            className="text-sm text-slate-600 hover:text-slate-900 hover:underline"
          >
            View audit log →
          </Link>
        </div>
      </div>
    </div>
  );
}
