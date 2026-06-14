import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { TopBar } from "@/components/layout/top-bar";
import { ChurchSettingsForm } from "@/components/settings/church-settings-form";
import type { SessionMembership } from "@/lib/auth/types";

export default async function ChurchSettingsPage() {
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

  const [church, settings] = await Promise.all([
    (db.church.findUnique as PrismaBypass)({
      where: { id: membership.churchId, ...({ _bypassTenancyCheck: true } as object) },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        legalName: true,
        accentColor: true,
        logoUrl: true,
        locale: true,
      },
    }),
    (db.churchSettings.findUnique as PrismaBypass)({
      where: { churchId: membership.churchId, ...({ _bypassTenancyCheck: true } as object) },
      select: {
        customerSelfCancelWindowMinutes: true,
        smsEnabled: true,
        replyToEmail: true,
        displayName: true,
      },
    }),
  ]);

  if (!church) redirect("/auth/sign-in");

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Church Settings" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Church Settings</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Update your church profile and operational preferences.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-900">Profile</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Basic information about your church.
              </p>
            </div>
            <ChurchSettingsForm
              church={{
                id: church.id,
                name: church.name,
                slug: church.slug,
                timezone: church.timezone,
                legalName: church.legalName ?? null,
                accentColor: church.accentColor ?? null,
                logoUrl: church.logoUrl ?? null,
                locale: (church.locale as "EN" | "ES") ?? "EN",
              }}
              settings={{
                replyToEmail: settings?.replyToEmail ?? null,
                displayName: settings?.displayName ?? null,
                customerSelfCancelWindowMinutes:
                  settings?.customerSelfCancelWindowMinutes ?? 5,
                smsEnabled: settings?.smsEnabled ?? false,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
