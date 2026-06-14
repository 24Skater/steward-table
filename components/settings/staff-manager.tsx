"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MembershipStatus, Role } from "@prisma/client";
import { useState } from "react";

interface StaffMembership {
  id: string;
  userId: string;
  roles: Role[];
  status: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface StaffManagerProps {
  memberships: StaffMembership[];
  currentUserId: string;
  canManage: boolean;
  canInvite: boolean;
}

const ALL_ROLES: Role[] = ["OWNER", "ADMIN", "STAFF", "COOK", "DRIVER", "VIEWER"];

const ROLE_COLORS: Record<Role, string> = {
  OWNER: "bg-purple-100 text-purple-800",
  ADMIN: "bg-blue-100 text-blue-800",
  STAFF: "bg-green-100 text-green-800",
  COOK: "bg-orange-100 text-orange-800",
  DRIVER: "bg-yellow-100 text-yellow-800",
  VIEWER: "bg-slate-100 text-slate-700",
};

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  if (email) return (email[0] ?? "U").toUpperCase();
  return "?";
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function StaffManager({
  memberships,
  currentUserId,
  canManage,
  canInvite,
}: StaffManagerProps) {
  const [localMemberships, setLocalMemberships] = useState<StaffMembership[]>(memberships);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRoles, setEditingRoles] = useState<Role[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  function startEdit(m: StaffMembership) {
    setEditingId(m.id);
    setEditingRoles([...m.roles]);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingRoles([]);
  }

  function toggleEditRole(role: Role) {
    setEditingRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  async function saveRoles(membershipId: string) {
    setSavingId(membershipId);
    setRowErrors((prev) => ({ ...prev, [membershipId]: "" }));
    try {
      const res = await fetch("/api/settings/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, roles: editingRoles }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setRowErrors((prev) => ({ ...prev, [membershipId]: data.error ?? "Failed to save roles" }));
      } else {
        setLocalMemberships((prev) =>
          prev.map((m) => (m.id === membershipId ? { ...m, roles: editingRoles } : m)),
        );
        setEditingId(null);
      }
    } catch {
      setRowErrors((prev) => ({ ...prev, [membershipId]: "Network error" }));
    } finally {
      setSavingId(null);
    }
  }

  async function toggleStatus(m: StaffMembership) {
    const newStatus: MembershipStatus = m.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setTogglingId(m.id);
    setRowErrors((prev) => ({ ...prev, [m.id]: "" }));
    try {
      const res = await fetch("/api/settings/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId: m.id, status: newStatus }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setRowErrors((prev) => ({ ...prev, [m.id]: data.error ?? "Failed to update status" }));
      } else {
        setLocalMemberships((prev) =>
          prev.map((mem) => (mem.id === m.id ? { ...mem, status: newStatus } : mem)),
        );
      }
    } catch {
      setRowErrors((prev) => ({ ...prev, [m.id]: "Network error" }));
    } finally {
      setTogglingId(null);
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteMessage(null);
    try {
      const res = await fetch("/api/settings/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        invited?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setInviteMessage({ type: "error", text: data.error ?? "Failed to send invitation" });
      } else if (data.invited) {
        setInviteMessage({ type: "success", text: `Invitation sent to ${inviteEmail.trim()}` });
        setInviteEmail("");
      } else {
        setInviteMessage({ type: "error", text: data.message ?? "Could not send invitation" });
      }
    } catch {
      setInviteMessage({ type: "error", text: "Network error" });
    } finally {
      setInviteLoading(false);
    }
  }

  const isOwner = (m: StaffMembership) => m.roles.includes("OWNER");
  const isSelf = (m: StaffMembership) => m.user.id === currentUserId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Staff</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Manage your church staff members, roles, and access.
        </p>
      </div>

      {/* Invite form */}
      {canInvite && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Invite a member</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Add an existing Steward Table user to your church by their email address.
            </p>
          </div>
          <form onSubmit={sendInvite} className="flex gap-3 items-end">
            <div className="flex-1 max-w-sm">
              <Label htmlFor="invite-email" className="mb-1.5 block text-sm text-slate-700">
                Email address
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="member@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviteLoading}
                required
              />
            </div>
            <Button type="submit" disabled={inviteLoading || !inviteEmail.trim()}>
              {inviteLoading ? "Sending…" : "Send invite"}
            </Button>
          </form>
          {inviteMessage && (
            <p
              className={`mt-2 text-sm ${
                inviteMessage.type === "success" ? "text-green-700" : "text-red-600"
              }`}
            >
              {inviteMessage.text}
            </p>
          )}
        </div>
      )}

      {/* Staff table */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                Member
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                Roles
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                Joined
              </th>
              {canManage && (
                <th className="px-4 py-3 text-left font-medium text-slate-600 whitespace-nowrap">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {localMemberships.map((m) => {
              const owner = isOwner(m);
              const self = isSelf(m);
              const rowError = rowErrors[m.id];
              const isEditing = editingId === m.id;

              return (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  {/* Member */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {m.user.image && <AvatarImage src={m.user.image} alt={m.user.name ?? ""} />}
                        <AvatarFallback className="text-xs">
                          {getInitials(m.user.name, m.user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-slate-800">
                          {m.user.name ?? m.user.email ?? "Unknown"}
                          {self && (
                            <span className="ml-1.5 text-xs text-slate-400 font-normal">(You)</span>
                          )}
                        </p>
                        {m.user.name && m.user.email && (
                          <p className="text-xs text-slate-500">{m.user.email}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Roles */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_ROLES.filter((r) => r !== "OWNER").map((role) => {
                          const checked = editingRoles.includes(role);
                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => toggleEditRole(role)}
                              className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                                checked
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-white text-slate-600 border-slate-300 hover:border-blue-400"
                              }`}
                            >
                              {role}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {m.roles.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[role]}`}
                          >
                            {owner && role === "OWNER" && (
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                              </svg>
                            )}
                            {role}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={
                        m.status === "ACTIVE"
                          ? "border-green-300 text-green-700 bg-green-50"
                          : m.status === "SUSPENDED"
                            ? "border-amber-300 text-amber-700 bg-amber-50"
                            : "border-slate-300 text-slate-600 bg-slate-50"
                      }
                    >
                      {m.status}
                    </Badge>
                  </td>

                  {/* Joined */}
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatDate(m.createdAt)}
                  </td>

                  {/* Actions */}
                  {canManage && (
                    <td className="px-4 py-3">
                      {owner ? (
                        <span className="text-xs text-slate-400 italic">Protected</span>
                      ) : self ? (
                        <span className="text-xs text-slate-400 italic">—</span>
                      ) : isEditing ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveRoles(m.id)}
                            disabled={savingId === m.id}
                          >
                            {savingId === m.id ? "Saving…" : "Save"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(m)}>
                            Edit roles
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className={
                              m.status === "ACTIVE"
                                ? "text-amber-700 border-amber-300 hover:bg-amber-50"
                                : "text-green-700 border-green-300 hover:bg-green-50"
                            }
                            onClick={() => toggleStatus(m)}
                            disabled={togglingId === m.id}
                          >
                            {togglingId === m.id
                              ? "…"
                              : m.status === "ACTIVE"
                                ? "Deactivate"
                                : "Reactivate"}
                          </Button>
                        </div>
                      )}
                      {rowError && <p className="text-xs text-red-600 mt-1">{rowError}</p>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {localMemberships.length === 0 && (
          <div className="px-4 py-8 text-center text-slate-500 text-sm">
            No staff members found.
          </div>
        )}
      </div>
    </div>
  );
}
