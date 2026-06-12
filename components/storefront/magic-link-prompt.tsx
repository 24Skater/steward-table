"use client";

import { useState } from "react";

interface MagicLinkPromptProps {
  churchSlug: string;
  orderId: string;
  maskedPhone: string;
}

type State = "idle" | "loading" | "sent" | "error";

export function MagicLinkPrompt({ churchSlug, orderId, maskedPhone }: MagicLinkPromptProps) {
  const [state, setState] = useState<State>("idle");

  async function handleRequest() {
    setState("loading");
    try {
      const res = await fetch(
        `/api/storefront/${churchSlug}/orders/${orderId}/magic-link`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed");
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
        <p className="text-sm font-medium text-emerald-700">Link sent to {maskedPhone}</p>
        <p className="mt-0.5 text-xs text-emerald-600">Tap the link in your messages to track this order.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
      <p className="text-sm font-medium text-slate-700">Track your order on any device</p>
      <p className="mt-0.5 text-xs text-slate-500">
        We&apos;ll send a link to {maskedPhone}
      </p>
      {state === "error" && (
        <p className="mt-1 text-xs text-red-500">Something went wrong. Try again.</p>
      )}
      <button
        onClick={handleRequest}
        disabled={state === "loading"}
        className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
      >
        {state === "loading" ? "Sending…" : "Text me a tracking link"}
      </button>
    </div>
  );
}
