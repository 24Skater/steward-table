"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, Copy, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PaymentSettingsProps {
  stripeMode: string;
  hasStripeKey: boolean;
  hasWebhookSecret: boolean;
  webhookUrl: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function PaymentSettings({
  stripeMode: initialStripeMode,
  hasStripeKey: initialHasStripeKey,
  hasWebhookSecret: initialHasWebhookSecret,
  webhookUrl,
}: PaymentSettingsProps) {
  const [stripeMode] = useState(initialStripeMode);
  const [hasStripeKey, setHasStripeKey] = useState(initialHasStripeKey);
  const [hasWebhookSecret, setHasWebhookSecret] = useState(initialHasWebhookSecret);

  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showStripeKey, setShowStripeKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silently skip
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!stripeSecretKey.trim() && !webhookSecret.trim()) {
      return;
    }

    setSaveState("saving");
    setErrorMessage(null);

    try {
      const body: Record<string, string> = {};
      if (stripeSecretKey.trim()) body.stripeSecretKey = stripeSecretKey.trim();
      if (webhookSecret.trim()) body.stripeWebhookSecret = webhookSecret.trim();

      const res = await fetch("/api/settings/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to save payment settings");
      }

      const data = (await res.json()) as {
        hasStripeKey: boolean;
        hasWebhookSecret: boolean;
      };

      if (data.hasStripeKey) setHasStripeKey(true);
      if (data.hasWebhookSecret) setHasWebhookSecret(true);

      setStripeSecretKey("");
      setWebhookSecret("");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setSaveState("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const isSubmittable =
    saveState !== "saving" && (!!stripeSecretKey.trim() || !!webhookSecret.trim());

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Stripe Mode */}
      <div className="space-y-1.5">
        <Label htmlFor="stripe-mode">Stripe Mode</Label>
        <select
          id="stripe-mode"
          value={stripeMode}
          disabled
          className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="BYO">BYO Keys (your own Stripe account)</option>
          <option value="CONNECT">Stripe Connect (coming soon)</option>
        </select>
        <p className="text-xs text-slate-500">
          Stripe Connect allows platform-level management. Available in a future release.
        </p>
      </div>

      {/* Stripe Secret Key */}
      <div className="space-y-1.5">
        <Label htmlFor="stripe-secret-key">Stripe Secret Key</Label>
        {hasStripeKey && !stripeSecretKey && (
          <p className="text-xs text-slate-500 font-mono">
            A key is saved. Enter a new value to replace it.
          </p>
        )}
        <div className="relative">
          <Input
            id="stripe-secret-key"
            type={showStripeKey ? "text" : "password"}
            value={stripeSecretKey}
            onChange={(e) => setStripeSecretKey(e.target.value)}
            placeholder={hasStripeKey ? "sk_****...****" : "sk_live_... or sk_test_..."}
            className="pr-10"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShowStripeKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={showStripeKey ? "Hide key" : "Show key"}
          >
            {showStripeKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Your Stripe Secret Key. Starts with sk_live_ or sk_test_. Never share this.
        </p>
      </div>

      {/* Webhook Secret */}
      <div className="space-y-1.5">
        <Label htmlFor="webhook-secret">Stripe Webhook Secret</Label>
        {hasWebhookSecret && !webhookSecret && (
          <p className="text-xs text-slate-500 font-mono">
            A webhook secret is saved. Enter a new value to replace it.
          </p>
        )}
        <div className="relative">
          <Input
            id="webhook-secret"
            type={showWebhookSecret ? "text" : "password"}
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={hasWebhookSecret ? "whsec_****...****" : "whsec_..."}
            className="pr-10"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShowWebhookSecret((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={showWebhookSecret ? "Hide secret" : "Show secret"}
          >
            {showWebhookSecret ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Found in Stripe Dashboard &rarr; Webhooks. Used to verify webhook signatures.
        </p>
      </div>

      {/* Webhook URL */}
      <div className="space-y-1.5">
        <Label>Webhook URL</Label>
        <div className="flex items-center gap-2">
          <Input
            value={webhookUrl}
            readOnly
            className="font-mono text-xs bg-slate-50 text-slate-600 cursor-default"
            aria-label="Webhook URL"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <span className="flex items-center gap-1">
                <CheckCheck size={14} />
                Copied!
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Copy size={14} />
                Copy
              </span>
            )}
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Add this URL to your Stripe Dashboard under Webhooks.
        </p>
      </div>

      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      <Button type="submit" disabled={!isSubmittable}>
        {saveState === "saving" && "Saving..."}
        {saveState === "saved" && (
          <span className="flex items-center gap-1.5">
            <Check size={14} />
            Saved
          </span>
        )}
        {(saveState === "idle" || saveState === "error") && "Save payment settings"}
      </Button>
    </form>
  );
}
