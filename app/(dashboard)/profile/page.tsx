import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TopBar } from "@/components/layout/top-bar";
import { ProfileForm } from "@/components/settings/profile-form";
import type { SessionMembership } from "@/lib/auth/types";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const activeMembership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!activeMembership) redirect("/onboarding");

  const [user, membership] = await Promise.all([
    (db.user.findUnique as Function)({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
      },
      _bypassTenancyCheck: true,
    }) as Promise<{
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      phone: string | null;
    } | null>,

    (db.membership.findFirst as Function)({
      where: {
        userId: session.user.id,
        churchId: activeMembership.churchId,
        status: "ACTIVE",
      },
      select: {
        roles: true,
        createdAt: true,
      },
      _bypassTenancyCheck: true,
    }) as Promise<{
      roles: string[];
      createdAt: Date;
    } | null>,
  ]);

  if (!user) redirect("/auth/sign-in");

  return (
    <div className="flex flex-col h-full">
      <TopBar title="My Profile" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg">
          <ProfileForm
            user={user}
            membership={
              membership
                ? {
                    roles: membership.roles,
                    memberSince: membership.createdAt.toISOString(),
                  }
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}
