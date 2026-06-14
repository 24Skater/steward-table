"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { useState } from "react";

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
  hasPassword?: boolean;
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
      return `${parts[0]?.[0]}${parts[parts.length - 1]?.[0]}`.toUpperCase();
    }
    return (parts[0] ?? "").slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "??";
}

export function ProfileForm({ user, membership, hasPassword = false }: ProfileFormProps) {
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaveState, setPwSaveState] = useState<SaveState>("idle");
  const [pwError, setPwError] = useState<string | null>(null);

  const initials = getInitials(user.name, user.email);

  const memberSinceFormatted = membership
    ? new Date(membership.memberSince).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);

    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }

    setPwSaveState("saving");
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to change password");
      }

      setPwSaveState("saved");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSaveState("idle"), 2500);
    } catch (err) {
      setPwSaveState("error");
      setPwError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

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
            <p className="text-xs text-slate-500">Email address cannot be changed here.</p>
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

          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

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

      {/* Password change section — only for credentials users */}
      {hasPassword && (
        <section className="border-t border-slate-200 pt-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
            Change Password
          </h2>
          <form onSubmit={(e) => void handlePasswordSubmit(e)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current Password</Label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-slate-400">Minimum 8 characters.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {pwError && <p className="text-sm text-red-600">{pwError}</p>}

            <Button type="submit" disabled={pwSaveState === "saving"} variant="outline">
              {pwSaveState === "saving" && "Saving..."}
              {pwSaveState === "saved" && (
                <span className="flex items-center gap-1.5">
                  <Check size={14} />
                  Password updated
                </span>
              )}
              {(pwSaveState === "idle" || pwSaveState === "error") && "Update password"}
            </Button>
          </form>
        </section>
      )}

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
