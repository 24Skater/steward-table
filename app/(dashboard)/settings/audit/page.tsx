import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { TopBar } from "@/components/layout/top-bar";
import type { SessionMembership } from "@/lib/auth/types";
import type { Role } from "@prisma/client";

interface AuditLogRow {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  ip: string | null;
  createdAt: Date;
  actor: {
    name: string | null;
    email: string | null;
  } | null;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (diffSec < 60) return rtf.format(-diffSec, "second");
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  if (diffHour < 24) return rtf.format(-diffHour, "hour");
  if (diffDay < 30) return rtf.format(-diffDay, "day");

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AuditLogPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const canResult = await can("audit.read", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles as Role[],
  });

  if (!canResult.allowed) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Audit Log" />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-slate-500 text-sm">Access denied.</p>
        </div>
      </div>
    );
  }

  const rawLogs = await (db.auditLog.findMany as PrismaBypass)({
    where: { churchId: membership.churchId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      resource: true,
      resourceId: true,
      ip: true,
      createdAt: true,
      actor: {
        select: { name: true, email: true },
      },
    },
    ...({ _bypassTenancyCheck: true } as object),
  }) as AuditLogRow[];

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Audit Log" />
      <div className="flex-1 overflow-y-auto p-6">
        {rawLogs.length === 0 ? (
          <p className="text-slate-500 text-sm">No audit log entries found.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                    Actor
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                    Resource
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rawLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatRelativeTime(new Date(log.createdAt))}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {log.actor ? (
                        <div>
                          <p className="font-medium text-slate-800">
                            {log.actor.name ?? "—"}
                          </p>
                          {log.actor.email && (
                            <p className="text-xs text-slate-500">{log.actor.email}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <code className="font-mono text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        {log.action}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {log.resource}
                      {log.resourceId && (
                        <span className="text-slate-400 text-xs ml-1">
                          #{log.resourceId.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">
                      {log.ip ? log.ip.slice(0, 12) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
