import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { TopBar } from "@/components/layout/top-bar";
import { StaffManager } from "@/components/settings/staff-manager";
import type { SessionMembership } from "@/lib/auth/types";
import type { Role } from "@prisma/client";

interface StaffMembership {
  id: string;
  userId: string;
  churchId: string;
  roles: Role[];
  status: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const canInvite = await can("member.invite", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles as Role[],
  });

  const canUpdate = await can("member.update", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles as Role[],
  });

  if (!canInvite.allowed && !canUpdate.allowed) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Staff" />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-slate-500 text-sm">Access denied.</p>
        </div>
      </div>
    );
  }

  const memberships = await (db.membership.findMany as PrismaBypass)({
    where: { churchId: membership.churchId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: "asc" },
    ...({ _bypassTenancyCheck: true } as object),
  }) as StaffMembership[];

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Staff" />
      <div className="flex-1 overflow-y-auto p-6">
        <StaffManager
          memberships={memberships}
          currentUserId={session.user.id}
          canManage={canInvite.allowed || canUpdate.allowed}
          canInvite={canInvite.allowed}
        />
      </div>
    </div>
  );
}
