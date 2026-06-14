import { AcceptInviteCard } from "@/components/invite/accept-invite-card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await (db.invitation.findUnique as PrismaBypass)({
    where: { token },
    include: { church: { select: { name: true, slug: true } } },
    _bypassTenancyCheck: true,
  });

  if (!invitation) notFound();

  const isExpired = new Date(invitation.expiresAt) < new Date();
  if (isExpired) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-sm w-full text-center space-y-3">
          <h1 className="text-xl font-semibold text-slate-900">Invitation expired</h1>
          <p className="text-slate-500 text-sm">
            This invitation link has expired. Ask your church admin to send a new one.
          </p>
        </div>
      </div>
    );
  }

  if (invitation.status === "ACCEPTED") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-sm w-full text-center space-y-3">
          <h1 className="text-xl font-semibold text-slate-900">Already accepted</h1>
          <p className="text-slate-500 text-sm">
            This invitation has already been used.{" "}
            <a href="/auth/sign-in" className="text-emerald-600 hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    );
  }

  const session = await auth();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <AcceptInviteCard
        token={token}
        churchName={invitation.church?.name ?? "your church"}
        invitedEmail={invitation.email}
        isSignedIn={!!session?.user?.id}
        currentUserEmail={session?.user?.email ?? null}
      />
    </div>
  );
}
