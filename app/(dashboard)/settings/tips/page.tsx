import { TopBar } from "@/components/layout/top-bar";
import { TipSettingsForm } from "@/components/settings/tip-settings-form";
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { redirect } from "next/navigation";

export default async function TipSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const result = await can("settings.payment", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) redirect("/");

  const settings = await (db.churchSettings.findUnique as PrismaBypass)({
    where: { churchId: membership.churchId },
    select: { brandTokens: true },
    _bypassTenancyCheck: true,
  });

  const tokens =
    settings?.brandTokens && typeof settings.brandTokens === "object"
      ? (settings.brandTokens as Record<string, unknown>)
      : {};

  const tipEnabled = typeof tokens.tipEnabled === "boolean" ? tokens.tipEnabled : false;
  const tipPercentages = Array.isArray(tokens.tipPercentages)
    ? (tokens.tipPercentages as unknown[]).filter((v): v is number => typeof v === "number")
    : [10, 15, 20];

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Tip Settings" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Tip Settings</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Configure whether customers can add a tip at checkout and which amounts to offer.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-900">Tip Options</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                These options appear on the storefront checkout page.
              </p>
            </div>
            <TipSettingsForm initialEnabled={tipEnabled} initialPercentages={tipPercentages} />
          </div>
        </div>
      </div>
    </div>
  );
}
