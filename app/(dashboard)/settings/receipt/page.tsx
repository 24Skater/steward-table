import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { TopBar } from "@/components/layout/top-bar";
import { ReceiptSettingsForm } from "@/components/settings/receipt-settings-form";
import type { SessionMembership } from "@/lib/auth/types";

export default async function ReceiptSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const permission = await can("settings.receipt", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!permission.allowed) redirect("/settings");

  const [church, settings] = await Promise.all([
    (db.church.findUnique as PrismaBypass)({
      where: { id: membership.churchId },
      select: { name: true, ein: true },
      _bypassTenancyCheck: true,
    }),
    db.churchSettings.findUnique({
      where: { churchId: membership.churchId },
      select: {
        receiptLanguage: true,
        receiptCustomFooter: true,
      },
    }),
  ]);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Receipt Settings" />
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        <ReceiptSettingsForm
          churchName={church?.name ?? ""}
          initialEin={church?.ein ?? ""}
          initialLanguage={settings?.receiptLanguage ?? "OFF"}
          initialCustomFooter={settings?.receiptCustomFooter ?? ""}
        />
      </div>
    </div>
  );
}
