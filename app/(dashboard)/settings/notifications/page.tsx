import { TopBar } from "@/components/layout/top-bar";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form";
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";

interface NotificationBrandTokens {
  emailConfirmationEnabled?: boolean;
  emailStatusEnabled?: boolean;
  emailStaffOnNewOrder?: boolean;
  smsConfirmationEnabled?: boolean;
  smsReadyEnabled?: boolean;
}

function parseNotificationPrefs(brandTokens: unknown): NotificationBrandTokens {
  if (!brandTokens || typeof brandTokens !== "object") {
    return {
      emailConfirmationEnabled: true,
      emailStatusEnabled: true,
      emailStaffOnNewOrder: false,
      smsConfirmationEnabled: false,
      smsReadyEnabled: false,
    };
  }
  const raw = brandTokens as Record<string, unknown>;
  return {
    emailConfirmationEnabled:
      typeof raw.emailConfirmationEnabled === "boolean" ? raw.emailConfirmationEnabled : true,
    emailStatusEnabled: typeof raw.emailStatusEnabled === "boolean" ? raw.emailStatusEnabled : true,
    emailStaffOnNewOrder:
      typeof raw.emailStaffOnNewOrder === "boolean" ? raw.emailStaffOnNewOrder : false,
    smsConfirmationEnabled:
      typeof raw.smsConfirmationEnabled === "boolean" ? raw.smsConfirmationEnabled : false,
    smsReadyEnabled: typeof raw.smsReadyEnabled === "boolean" ? raw.smsReadyEnabled : false,
  };
}

export default async function NotificationsSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const canResult = await can("church.update", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles as Role[],
  });

  if (!canResult.allowed) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Notification Preferences" />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-slate-500 text-sm">Access denied.</p>
        </div>
      </div>
    );
  }

  const settings = (await (db.churchSettings.findUnique as PrismaBypass)({
    where: { churchId: membership.churchId },
    select: {
      smsEnabled: true,
      brandTokens: true,
    },
    ...({ _bypassTenancyCheck: true } as object),
  })) as { smsEnabled: boolean; brandTokens: unknown } | null;

  const notificationPrefs = parseNotificationPrefs(settings?.brandTokens);
  const smsEnabled = settings?.smsEnabled ?? false;
  const twilioEnabled = !!process.env.TWILIO_ACCOUNT_SID;

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Notification Preferences" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Notification Preferences</h1>
            <p className="mt-1 text-sm text-slate-500">
              Control how your church communicates with customers and staff about orders.
            </p>
          </div>

          <NotificationPreferencesForm
            initialValues={{
              emailConfirmationEnabled: notificationPrefs.emailConfirmationEnabled ?? true,
              emailStatusEnabled: notificationPrefs.emailStatusEnabled ?? true,
              emailStaffOnNewOrder: notificationPrefs.emailStaffOnNewOrder ?? false,
              smsEnabled,
              smsConfirmationEnabled: notificationPrefs.smsConfirmationEnabled ?? false,
              smsReadyEnabled: notificationPrefs.smsReadyEnabled ?? false,
            }}
            twilioEnabled={twilioEnabled}
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              <span className="font-medium">Personal notifications</span> — delivery of
              notifications depends on your phone and email being set in your profile.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
