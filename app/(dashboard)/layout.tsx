import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import type { SessionMembership } from "@/lib/auth/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const activeMembership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!activeMembership) {
    redirect("/onboarding");
  }

  const church = await db.church.findUnique({
    where: { id: activeMembership.churchId },
    select: { name: true },
    ...({ _bypassTenancyCheck: true } as object),
  });

  return (
    <div className="flex w-full h-screen overflow-hidden bg-slate-100">
      <Sidebar churchName={church?.name} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
