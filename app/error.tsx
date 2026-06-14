"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-[500px] rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <h1 className="mb-2 text-xl font-semibold text-slate-800">Something went wrong</h1>
          <p className="mb-6 text-sm text-slate-500">
            An unexpected error occurred. Please try again or return to the dashboard.
          </p>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={reset}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              Try again
            </button>
            <Link
              href="/orders"
              className="rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              Go to dashboard
            </Link>
          </div>
          {error.digest && (
            <p className="mt-6 text-xs text-slate-400">Error reference: {error.digest}</p>
          )}
        </div>
      </div>
    </div>
  );
}
