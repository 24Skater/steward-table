import type { Route } from "next";
import Link from "next/link";

/**
 * Where the middleware sends someone whose organization cannot use Table.
 *
 * Three different situations reach this page and they are not interchangeable —
 * one is a sales conversation, one is an unpaid invoice, one is an expired
 * subscription. Telling a church "subscription required" when they have never
 * had one, or asking them to pay when they only need to stop writing, is how
 * support tickets get made.
 */

export const dynamic = "force-dynamic";

type Reason = "not_subscribed" | "revoked" | "read_only";

const MESSAGES: Record<Reason, { title: string; body: string; action: string }> = {
  not_subscribed: {
    title: "Table isn't part of this subscription",
    body: "Your organization has access to Steward, but not to Table. An administrator can add it from the billing console.",
    action: "Add Table",
  },
  revoked: {
    title: "This subscription has ended",
    body: "Access to Table has ended for your organization. Your data is retained for 90 days, so reactivating restores everything exactly as it was.",
    action: "Reactivate",
  },
  read_only: {
    title: "Table is read-only",
    body: "You can still view and export everything, but changes are paused until billing is up to date.",
    action: "Update billing",
  },
};

function isReason(value: string | undefined): value is Reason {
  return value === "not_subscribed" || value === "revoked" || value === "read_only";
}

export default async function BillingRequiredPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = MESSAGES[isReason(reason) ? reason : "not_subscribed"];

  const consoleUrl = process.env.NEXT_PUBLIC_PLATFORM_CONSOLE_URL;

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{message.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{message.body}</p>

        <div className="mt-6 flex flex-col gap-3">
          {consoleUrl ? (
            <a
              href={`${consoleUrl}/billing`}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              {message.action}
            </a>
          ) : (
            // Self-hosted deployments have no console to link to. Reaching this
            // page at all would be surprising there, so say something true
            // rather than offering a button that goes nowhere.
            <p className="text-sm text-slate-500">
              Contact whoever administers this Steward installation.
            </p>
          )}

          <Link
            href={"/" as Route}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Back
          </Link>
        </div>
      </div>
    </main>
  );
}
