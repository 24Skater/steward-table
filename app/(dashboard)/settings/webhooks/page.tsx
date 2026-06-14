import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import { TopBar } from "@/components/layout/top-bar";
import type { SessionMembership } from "@/lib/auth/types";
import type { Role } from "@prisma/client";

interface WebhookEventRow {
  id: string;
  eventId: string;
  eventType: string;
  signatureValid: boolean;
  processedAt: Date | null;
  processingError: string | null;
  createdAt: Date;
}

export default async function WebhooksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) redirect("/auth/sign-in");

  const canResult = await can("settings.payment", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles as Role[],
  });

  if (!canResult.allowed) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Webhook Events" />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-slate-500 text-sm">Access denied.</p>
        </div>
      </div>
    );
  }

  const events = await (db.webhookEvent.findMany as PrismaBypass)({
    where: { churchId: membership.churchId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      eventId: true,
      eventType: true,
      signatureValid: true,
      processedAt: true,
      processingError: true,
      createdAt: true,
    },
    ...({ _bypassTenancyCheck: true } as object),
  }) as WebhookEventRow[];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.steward.app";
  const webhookEndpoint = `${appUrl}/api/payments/stripe/webhook`;

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Webhook Events" />
      <div className="flex-1 overflow-y-auto p-6">
        {events.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
            <p>
              No webhook events yet. Configure your Stripe webhook to{" "}
              <code className="font-mono text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                {webhookEndpoint}
              </code>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                    Event ID
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                    Event Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                    Signature
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event) => {
                  const status =
                    event.processingError != null
                      ? "error"
                      : event.processedAt != null
                        ? "processed"
                        : "pending";

                  return (
                    <tr key={event.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(event.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <code className="font-mono text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                          {event.eventId.length > 16
                            ? `${event.eventId.slice(0, 16)}...`
                            : event.eventId}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {event.eventType}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {event.signatureValid ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                            Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                            Invalid
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {status === "processed" && (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                            Processed
                          </span>
                        )}
                        {status === "pending" && (
                          <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/20">
                            Pending
                          </span>
                        )}
                        {status === "error" && (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                            Error
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {event.processingError != null
                          ? event.processingError.length > 40
                            ? `${event.processingError.slice(0, 40)}...`
                            : event.processingError
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
