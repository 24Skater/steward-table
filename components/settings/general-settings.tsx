"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Mountain Time — Arizona (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
];

interface GeneralSettingsProps {
  churchName: string;
  contactEmail: string | null;
  timezone: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function GeneralSettings({ churchName, contactEmail, timezone }: GeneralSettingsProps) {
  const [name, setName] = useState(churchName);
  const [email, setEmail] = useState(contactEmail ?? "");
  const [tz, setTz] = useState(timezone);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaveState("saving");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/settings/church", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          contactEmail: email.trim() || null,
          timezone: tz,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to save settings");
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

      <div className="space-y-1.5">
        <Label htmlFor="contact-email">Contact Email</Label>
        <Input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="office@mychurch.org"
        />
        <p className="text-xs text-slate-500">
          Used as the reply-to address for outgoing messages.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <select
          id="timezone"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
        >
          {TIMEZONES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      <Button type="submit" disabled={saveState === "saving" || !name.trim()}>
        {saveState === "saving" && "Saving..."}
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
