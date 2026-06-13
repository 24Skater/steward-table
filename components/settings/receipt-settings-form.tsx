"use client";

import { useState } from "react";

type ReceiptLanguage = "OFF" | "US_501C3" | "CUSTOM";

interface ReceiptSettingsFormProps {
  churchName: string;
  initialEin: string;
  initialLanguage: ReceiptLanguage;
  initialCustomFooter: string;
}

export function ReceiptSettingsForm({
  churchName,
  initialEin,
  initialLanguage,
  initialCustomFooter,
}: ReceiptSettingsFormProps) {
  const [language, setLanguage] = useState<ReceiptLanguage>(initialLanguage);
  const [ein, setEin] = useState(initialEin);
  const [customFooter, setCustomFooter] = useState(initialCustomFooter);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/receipt", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptLanguage: language,
          receiptCustomFooter: language === "CUSTOM" ? customFooter : null,
          ein: ein.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setMessage({ type: "error", text: data.error ?? "Failed to save" });
      } else {
        setMessage({ type: "success", text: "Receipt settings saved." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Receipt Language</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure what appears at the bottom of printed receipts and emailed confirmations.
        </p>
      </div>

      {/* Receipt language selector */}
      <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
        {(
          [
            {
              value: "OFF" as const,
              label: "Standard receipt",
              desc: "No charitable language or tax-deductibility claims.",
            },
            {
              value: "US_501C3" as const,
              label: "US 501(c)(3) preset",
              desc: "Adds your church name, EIN, and IRS-compliant quid-pro-quo disclosure.",
            },
            {
              value: "CUSTOM" as const,
              label: "Custom footer",
              desc: "Write your own receipt footer text (supports EN/ES or any language).",
            },
          ] as const
        ).map(({ value, label, desc }) => (
          <label
            key={value}
            className={[
              "flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors",
              language === value ? "bg-slate-50" : "",
            ].join(" ")}
          >
            <input
              type="radio"
              name="receiptLanguage"
              value={value}
              checked={language === value}
              onChange={() => setLanguage(value)}
              className="mt-0.5 accent-slate-800"
            />
            <div>
              <p className="text-sm font-medium text-slate-800">{label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
            </div>
          </label>
        ))}
      </div>

      {/* EIN (shown for 501c3) */}
      {language === "US_501C3" && (
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block" htmlFor="ein">
            EIN (Employer Identification Number)
          </label>
          <input
            id="ein"
            type="text"
            value={ein}
            onChange={(e) => setEin(e.target.value)}
            placeholder="12-3456789"
            maxLength={20}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <p className="text-xs text-slate-400 mt-1">
            Appears on receipts as: &ldquo;{churchName} is a 501(c)(3) nonprofit. EIN: {ein || "—"}&rdquo;
          </p>
        </div>
      )}

      {/* Custom footer text */}
      {language === "CUSTOM" && (
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block" htmlFor="custom-footer">
            Custom footer text
          </label>
          <textarea
            id="custom-footer"
            value={customFooter}
            onChange={(e) => setCustomFooter(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Enter your receipt footer text. You can use newlines for formatting."
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-y"
          />
          <p className="text-xs text-slate-400 mt-1 text-right">{customFooter.length}/1000</p>
        </div>
      )}

      {message && (
        <p
          className={[
            "text-sm rounded-md px-3 py-2",
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700",
          ].join(" ")}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving…" : "Save receipt settings"}
      </button>
    </form>
  );
}
