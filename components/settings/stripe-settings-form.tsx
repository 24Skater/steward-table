"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, CheckCircle, Circle, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface StripeSettingsFormProps {
  hasPublishableKey: boolean;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

interface FormFields {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
}

interface FieldVisibility {
  publishableKey: boolean;
  secretKey: boolean;
  webhookSecret: boolean;
}

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
        connected ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      {connected ? (
        <CheckCircle size={12} className="shrink-0" />
      ) : (
        <Circle size={12} className="shrink-0" />
      )}
      {connected ? "Connected" : "Not configured"}
    </span>
  );
}

export function StripeSettingsForm({
  hasPublishableKey: initialHasPublishableKey,
  hasSecretKey: initialHasSecretKey,
  hasWebhookSecret: initialHasWebhookSecret,
}: StripeSettingsFormProps) {
  const [hasPublishableKey, setHasPublishableKey] = useState(initialHasPublishableKey);
  const [hasSecretKey, setHasSecretKey] = useState(initialHasSecretKey);
  const [hasWebhookSecret, setHasWebhookSecret] = useState(initialHasWebhookSecret);

  const [fields, setFields] = useState<FormFields>({
    publishableKey: "",
    secretKey: "",
    webhookSecret: "",
  });

  const [visible, setVisible] = useState<FieldVisibility>({
    publishableKey: false,
    secretKey: false,
    webhookSecret: false,
  });

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function toggleVisible(field: keyof FieldVisibility) {
    setVisible((prev) => ({ ...prev, [field]: !prev[field] }));
  }

  function setField(field: keyof FormFields, value: string) {
    setFields((prev) => ({ ...prev, [field]: value }));
  }

  const isConnected = hasPublishableKey && hasSecretKey && hasWebhookSecret;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const pk = fields.publishableKey.trim();
    const sk = fields.secretKey.trim();
    const ws = fields.webhookSecret.trim();

    if (!pk || !sk || !ws) {
      setErrorMessage("All three fields are required to save Stripe settings.");
      return;
    }

    setSaveState("saving");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/settings/payment/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishableKey: pk,
          secretKey: sk,
          webhookSecret: ws,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to save Stripe settings");
      }

      setHasPublishableKey(true);
      setHasSecretKey(true);
      setHasWebhookSecret(true);
      setFields({ publishableKey: "", secretKey: "", webhookSecret: "" });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setSaveState("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-lg">
      {/* Connection status */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Stripe connection</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            BYO Stripe account — your keys are stored encrypted.
          </p>
        </div>
        <StatusBadge connected={isConnected} />
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
        Secret key and webhook secret are stored encrypted with AES-256-GCM. Once saved, you cannot
        retrieve them — only replace them.
      </div>

      {/* Publishable key */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="pk-key">Publishable key</Label>
          {hasPublishableKey && <StatusBadge connected />}
        </div>
        {hasPublishableKey && !fields.publishableKey && (
          <p className="text-xs text-slate-500 font-mono">
            A publishable key is saved. Enter a new value to replace it.
          </p>
        )}
        <div className="relative">
          <Input
            id="pk-key"
            type={visible.publishableKey ? "text" : "password"}
            value={fields.publishableKey}
            onChange={(e) => setField("publishableKey", e.target.value)}
            placeholder={hasPublishableKey ? "pk_****...****" : "pk_live_... or pk_test_..."}
            className="pr-10"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => toggleVisible("publishableKey")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={visible.publishableKey ? "Hide key" : "Show key"}
          >
            {visible.publishableKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Starts with <code className="font-mono bg-slate-100 px-1 rounded">pk_live_</code> or{" "}
          <code className="font-mono bg-slate-100 px-1 rounded">pk_test_</code>. Safe to expose
          client-side.
        </p>
      </div>

      {/* Secret key */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="sk-key">Secret key</Label>
          {hasSecretKey && <StatusBadge connected />}
        </div>
        {hasSecretKey && !fields.secretKey && (
          <p className="text-xs text-slate-500 font-mono">
            A secret key is saved. Enter a new value to replace it.
          </p>
        )}
        <div className="relative">
          <Input
            id="sk-key"
            type={visible.secretKey ? "text" : "password"}
            value={fields.secretKey}
            onChange={(e) => setField("secretKey", e.target.value)}
            placeholder={hasSecretKey ? "sk_****...****" : "sk_live_... or sk_test_..."}
            className="pr-10"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => toggleVisible("secretKey")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={visible.secretKey ? "Hide key" : "Show key"}
          >
            {visible.secretKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Starts with <code className="font-mono bg-slate-100 px-1 rounded">sk_live_</code> or{" "}
          <code className="font-mono bg-slate-100 px-1 rounded">sk_test_</code>. Never share this.
        </p>
      </div>

      {/* Webhook secret */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="wh-secret">Webhook secret</Label>
          {hasWebhookSecret && <StatusBadge connected />}
        </div>
        {hasWebhookSecret && !fields.webhookSecret && (
          <p className="text-xs text-slate-500 font-mono">
            A webhook secret is saved. Enter a new value to replace it.
          </p>
        )}
        <div className="relative">
          <Input
            id="wh-secret"
            type={visible.webhookSecret ? "text" : "password"}
            value={fields.webhookSecret}
            onChange={(e) => setField("webhookSecret", e.target.value)}
            placeholder={hasWebhookSecret ? "whsec_****...****" : "whsec_..."}
            className="pr-10"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => toggleVisible("webhookSecret")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={visible.webhookSecret ? "Hide secret" : "Show secret"}
          >
            {visible.webhookSecret ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Found in Stripe Dashboard &rarr; Webhooks. Starts with{" "}
          <code className="font-mono bg-slate-100 px-1 rounded">whsec_</code>.
        </p>
      </div>

      {errorMessage && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {errorMessage}
        </p>
      )}

      <Button type="submit" disabled={saveState === "saving"}>
        {saveState === "saving" && "Saving..."}
        {saveState === "saved" && (
          <span className="flex items-center gap-1.5">
            <Check size={14} />
            Saved
          </span>
        )}
        {(saveState === "idle" || saveState === "error") && "Save Stripe settings"}
      </Button>
    </form>
  );
}
