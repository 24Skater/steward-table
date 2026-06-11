"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  phone: string | null;
}

interface ProfileMembership {
  roles: string[];
  memberSince: string;
}

interface ProfileFormProps {
  user: ProfileUser;
  membership: ProfileMembership | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  STAFF: "Staff",
  COOK: "Cook",
  DRIVER: "Driver",
  VIEWER: "Viewer",
};

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
    }
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "??";
}

export function ProfileForm({ user, membership }: ProfileFormProps) {
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initials = getInitials(user.name, user.email);

  const memberSinceFormatted = membership
    ? new Date(membership.memberSince).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSaveState("saving");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          phone: phone.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to save profile");
      }

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setSaveState("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="space-y-8">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 text-white text-xl font-semibold shrink-0">
          {initials}
        </div>
        <div>
          <p className="font-medium text-slate-900">{user.name ?? "No name set"}</p>
          <p className="text-sm text-slate-500">{user.email ?? ""}</p>
        </div>
      </div>

      {/* Personal info form */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
          Personal Information
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user.email ?? ""}
              readOnly
              disabled
              className="bg-slate-50 text-slate-400 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500">
              Email address cannot be changed here.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}

          <Button type="submit" disabled={saveState === "saving"}>
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
      </section>

      {/* Church role section */}
      {membership && (
        <section className="border-t border-slate-200 pt-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
            Church Role
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Roles</p>
              <div className="flex flex-wrap gap-1.5">
                {membership.roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700"
                  >
                    {ROLE_LABELS[role] ?? role}
                  </span>
                ))}
              </div>
            </div>
            {memberSinceFormatted && (
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Member since</p>
                <p className="text-sm text-slate-700">{memberSinceFormatted}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
