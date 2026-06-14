"use client";

import { AlertCircle } from "lucide-react";
import { usePathname } from "next/navigation";

interface StorefrontErrorProps {
  error: Error;
  reset: () => void;
}

export default function StorefrontError({ reset }: StorefrontErrorProps) {
  const pathname = usePathname();
  // Extract the church slug from the path (first segment after the leading slash)
  const churchSlug = pathname?.split("/")[1] ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-[500px] rounded-xl border border-slate-100 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
            <AlertCircle className="h-6 w-6 text-slate-400" />
          </div>
          <h1 className="mb-2 text-xl font-semibold text-slate-800">Oops, something went wrong.</h1>
          <p className="mb-6 text-sm text-slate-500">
            Please try again or contact the church for assistance.
          </p>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={reset}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              Try again
            </button>
            <a
              href={churchSlug ? `/${churchSlug}` : "/"}
              className="rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
            >
              Back to menu
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
