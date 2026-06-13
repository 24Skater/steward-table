import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SessionMembership } from "@/lib/auth/types";

export default async function DriverLayout({
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
    redirect("/auth/sign-in");
  }

  const church = await db.church.findUnique({
    where: { id: activeMembership.churchId },
    select: { name: true },
    ...({ _bypassTenancyCheck: true } as object),
  });

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
        <span className="font-semibold text-slate-800 text-sm truncate">
          {church?.name ?? "Steward Table"}
        </span>
        <a
          href="/api/auth/signout"
          className="text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
        >
          Sign out
        </a>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
