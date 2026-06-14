"use client";

import { useState } from "react";

interface AcceptInviteCardProps {
  token: string;
  churchName: string;
  invitedEmail: string;
  isSignedIn: boolean;
  currentUserEmail: string | null;
}

export function AcceptInviteCard({
  token,
  churchName,
  invitedEmail,
  isSignedIn,
  currentUserEmail,
}: AcceptInviteCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invite/${token}/accept`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to accept invitation");
      window.location.href = "/orders";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const emailMismatch =
    isSignedIn && currentUserEmail !== null && currentUserEmail !== invitedEmail;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-sm w-full space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">You've been invited</h1>
        <p className="text-slate-600 text-sm">
          Join <span className="font-medium text-slate-900">{churchName}</span> on Steward Table
        </p>
      </div>

      {emailMismatch && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          This invitation was sent to <strong>{invitedEmail}</strong>. You are signed in as{" "}
          <strong>{currentUserEmail}</strong>.
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!isSignedIn ? (
        <div className="space-y-3">
          <a
            href={`/auth/sign-in?callbackUrl=/invite/${encodeURIComponent(token)}`}
            className="block w-full text-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Sign in to accept
          </a>
          <p className="text-center text-slate-500 text-xs">
            Don&apos;t have an account?{" "}
            <a
              href={`/auth/sign-in?callbackUrl=/invite/${encodeURIComponent(token)}`}
              className="text-emerald-600 hover:underline"
            >
              Create one
            </a>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleAccept}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? "Accepting..." : emailMismatch ? "Accept anyway" : "Accept invitation"}
          </button>
          {emailMismatch && (
            <a
              href="/auth/sign-in"
              className="block w-full text-center px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              Sign in with a different account
            </a>
          )}
        </div>
      )}
    </div>
  );
}
