import { TopBar } from "@/components/layout/top-bar";
import { TeamPage } from "@/components/team";
import { auth } from "@/lib/auth";
import type { SessionMembership } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { redirect } from "next/navigation";

export default async function TeamRoute() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const [inviteResult, updateResult] = await Promise.all([
    can("member.invite", {
      userId: session.user.id,
      churchId: membership.churchId,
      roles: membership.roles,
    }),
    can("member.update", {
      userId: session.user.id,
      churchId: membership.churchId,
      roles: membership.roles,
    }),
  ]);

  // STAFF and below cannot access this page
  if (!inviteResult.allowed && !updateResult.allowed) {
    redirect("/");
  }

  const [members, invitations] = await Promise.all([
    (db.membership.findMany as PrismaBypass)({
      where: {
        churchId: membership.churchId,
        status: { in: ["ACTIVE", "SUSPENDED"] },
      },
      select: {
        id: true,
        roles: true,
        status: true,
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "asc" },
      _bypassTenancyCheck: true,
    }),
    inviteResult.allowed
      ? (db.invitation.findMany as PrismaBypass)({
          where: {
            churchId: membership.churchId,
            status: "PENDING",
          },
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            expiresAt: true,
          },
          orderBy: { createdAt: "desc" },
          _bypassTenancyCheck: true,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Team" />
      <div className="flex-1 overflow-y-auto p-6">
        <TeamPage
          initialMembers={members}
          initialInvitations={invitations}
          currentUserId={session.user.id}
          currentUserRoles={membership.roles}
          canInvite={inviteResult.allowed}
        />
      </div>
    </div>
  );
}
