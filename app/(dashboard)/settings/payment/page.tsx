import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { decrypt } from "@/lib/crypto/aes";
import { TopBar } from "@/components/layout/top-bar";
import { StripeSettingsForm } from "@/components/settings/stripe-settings-form";
import { CashZelleSettingsForm } from "@/components/settings/cash-zelle-settings-form";
import type { SessionMembership } from "@/lib/auth/types";
import type { Role } from "@prisma/client";

export default async function PaymentSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const canResult = await can("settings.payment", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles as Role[],
  });

  if (!canResult.allowed) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Payment Settings" />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-slate-500 text-sm">Access denied.</p>
        </div>
      </div>
    );
  }

  const churchSettings = await (db.churchSettings.findUnique as PrismaBypass)({
    where: { churchId: membership.churchId },
    select: { acceptCash: true, acceptZelle: true },
    _bypassTenancyCheck: true,
  }) as { acceptCash: boolean; acceptZelle: boolean } | null;

  const [stripeKey, webhookKey] = await Promise.all([
    (db.apiKey.findFirst as PrismaBypass)({
      where: {
        churchId: membership.churchId,
        provider: "stripe",
        isLive: true,
      },
      select: {
        id: true,
        encrypted: true,
        publishable: true,
      },
      ...({ _bypassTenancyCheck: true } as object),
    }),
    (db.apiKey.findFirst as PrismaBypass)({
      where: {
        churchId: membership.churchId,
        provider: "stripe_webhook",
        isLive: true,
      },
      select: {
        id: true,
        encrypted: true,
      },
      ...({ _bypassTenancyCheck: true } as object),
    }),
  ]);

  // Check if keys are set without passing decrypted values to the client
  let hasPublishableKey = false;
  let hasSecretKey = false;
  let hasWebhookSecret = false;

  if (stripeKey) {
    hasPublishableKey = !!stripeKey.publishable;
    try {
      if (stripeKey.encrypted) {
        decrypt(stripeKey.encrypted as Buffer);
        hasSecretKey = true;
      }
    } catch {
      // Key stored but cannot be decrypted — treat as not set
    }
  }

  if (webhookKey) {
    try {
      if (webhookKey.encrypted) {
        decrypt(webhookKey.encrypted as Buffer);
        hasWebhookSecret = true;
      }
    } catch {
      // Key stored but cannot be decrypted — treat as not set
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Payment Settings" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-slate-900">Stripe</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Connect your Stripe account to accept payments from your congregation.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <StripeSettingsForm
              hasPublishableKey={hasPublishableKey}
              hasSecretKey={hasSecretKey}
              hasWebhookSecret={hasWebhookSecret}
            />
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Alternative payment methods</h2>
            <p className="text-sm text-slate-500 mb-4">
              Enable cash or Zelle as payment options at checkout. These are always available even without Stripe.
            </p>
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <CashZelleSettingsForm
                initialAcceptCash={churchSettings?.acceptCash ?? true}
                initialAcceptZelle={churchSettings?.acceptZelle ?? false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
