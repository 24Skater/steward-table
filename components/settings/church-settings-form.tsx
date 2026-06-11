"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Mountain Time — Arizona (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
];

interface ChurchSettingsFormProps {
  church: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    legalName: string | null;
    accentColor: string | null;
    logoUrl: string | null;
  };
  settings: {
    replyToEmail: string | null;
    displayName: string | null;
    customerSelfCancelWindowMinutes: number;
    smsEnabled: boolean;
  };
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function ChurchSettingsForm({ church, settings }: ChurchSettingsFormProps) {
  const [name, setName] = useState(church.name);
  const [slug, setSlug] = useState(church.slug);
  const [timezone, setTimezone] = useState(church.timezone);
  const [legalName, setLegalName] = useState(church.legalName ?? "");
  const [logoUrl, setLogoUrl] = useState(church.logoUrl ?? "");
  const [accentColor, setAccentColor] = useState(church.accentColor ?? "#000000");
  const [replyToEmail, setReplyToEmail] = useState(settings.replyToEmail ?? "");
  const [displayName, setDisplayName] = useState(settings.displayName ?? "");
  const [cancelWindowMinutes, setCancelWindowMinutes] = useState(
    settings.customerSelfCancelWindowMinutes,
  );
  const [smsEnabled, setSmsEnabled] = useState(settings.smsEnabled);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const slugPattern = /^[a-z0-9-]+$/;
  const slugValid = slugPattern.test(slug);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !slugValid) return;

    setSaveState("saving");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/settings/church/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          timezone,
          legalName: legalName.trim() || null,
          logoUrl: logoUrl.trim() || null,
          accentColor: accentColor || null,
          replyToEmail: replyToEmail.trim() || null,
          displayName: displayName.trim() || null,
          customerSelfCancelWindowMinutes: cancelWindowMinutes,
          smsEnabled,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to save settings");
      }

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setSaveState("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {/* Church Name */}
      <div className="space-y-1.5">
        <Label htmlFor="church-name">Church Name</Label>
        <Input
          id="church-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First Baptist Church"
          required
        />
      </div>

      {/* Legal Name */}
      <div className="space-y-1.5">
        <Label htmlFor="legal-name">Legal Name</Label>
        <Input
          id="legal-name"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder="First Baptist Church of Springfield, Inc."
        />
        <p className="text-xs text-slate-500">
          Used on receipts and official communications, if different from the display name.
        </p>
      </div>

      {/* Logo URL */}
      <div className="space-y-1.5">
        <Label htmlFor="logo-url">Logo URL</Label>
        <Input
          id="logo-url"
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://example.com/logo.png"
        />
        <p className="text-xs text-slate-500">
          URL to your church logo. Shown in the storefront header.
        </p>
      </div>

      {/* Accent Color */}
      <div className="space-y-1.5">
        <Label htmlFor="accent-color">Accent Color</Label>
        <div className="flex items-center gap-2">
          <input
            id="accent-color"
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="h-10 w-10 cursor-pointer rounded-md border border-slate-200 p-1"
          />
          <span className="text-sm text-slate-500 font-mono">{accentColor}</span>
        </div>
        <p className="text-xs text-slate-500">
          Used as the brand color on the storefront.
        </p>
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <Label htmlFor="slug">URL Slug</Label>
        <Input
          id="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          placeholder="first-baptist"
          pattern="^[a-z0-9-]+$"
          required
        />
        {slug && !slugValid && (
          <p className="text-xs text-red-600">
            Only lowercase letters, numbers, and hyphens are allowed.
          </p>
        )}
        <p className="text-xs text-slate-500">
          Your storefront URL: <span className="font-mono">{slug || "…"}.table.steward.app</span>
        </p>
      </div>

      {/* Timezone */}
      <div className="space-y-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <select
          id="timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
        >
          {TIMEZONES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <hr className="border-slate-200" />

      {/* Contact / Reply-To Email */}
      <div className="space-y-1.5">
        <Label htmlFor="reply-to-email">Contact Email</Label>
        <Input
          id="reply-to-email"
          type="email"
          value={replyToEmail}
          onChange={(e) => setReplyToEmail(e.target.value)}
          placeholder="office@mychurch.org"
        />
        <p className="text-xs text-slate-500">
          Used as the reply-to address for outgoing emails.
        </p>
      </div>

      {/* Display Name */}
      <div className="space-y-1.5">
        <Label htmlFor="display-name">Display Name</Label>
        <Input
          id="display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="First Baptist"
        />
        <p className="text-xs text-slate-500">
          Short name shown in email footers and receipts.
        </p>
      </div>

      <hr className="border-slate-200" />

      {/* Self-cancel window */}
      <div className="space-y-1.5">
        <Label htmlFor="cancel-window">Self-cancel Window (minutes)</Label>
        <Input
          id="cancel-window"
          type="number"
          min={0}
          max={1440}
          value={cancelWindowMinutes}
          onChange={(e) => setCancelWindowMinutes(Number(e.target.value))}
        />
        <p className="text-xs text-slate-500">
          How long customers can cancel their own order after placing it. Set 0 to disable.
        </p>
      </div>

      {/* SMS opt-in */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
        <div className="space-y-0.5">
          <Label htmlFor="sms-enabled" className="text-sm font-medium text-slate-900">
            SMS Notifications
          </Label>
          <p className="text-xs text-slate-500">
            Enable SMS order updates for customers who opt in.
          </p>
        </div>
        <Switch
          id="sms-enabled"
          checked={smsEnabled}
          onCheckedChange={setSmsEnabled}
        />
      </div>

      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      <Button
        type="submit"
        disabled={saveState === "saving" || !name.trim() || !slug.trim() || !slugValid}
      >
        {saveState === "saving" && "Saving…"}
        {saveState === "saved" && (
          <span className="flex items-center gap-1.5">
            <Check size={14} />
            Saved
          </span>
        )}
        {(saveState === "idle" || saveState === "error") && "Save changes"}
      </Button>
    </form>
  );
}
