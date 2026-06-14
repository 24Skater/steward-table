"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MembershipStatus, Role } from "@prisma/client";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { RoleBadge } from "./role-badge";

export interface MemberRow {
  id: string;
  roles: Role[];
  status: MembershipStatus;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

const ASSIGNABLE_ROLES: { value: Role; label: string }[] = [
  { value: "OWNER", label: "Owner" },
  { value: "ADMIN", label: "Admin" },
  { value: "STAFF", label: "Staff" },
  { value: "COOK", label: "Cook" },
  { value: "DRIVER", label: "Driver" },
  { value: "VIEWER", label: "Viewer" },
];

const STATUS_STYLES: Record<MembershipStatus, string> = {
  ACTIVE: "border-transparent bg-green-100 text-green-800",
  SUSPENDED: "border-transparent bg-yellow-100 text-yellow-800",
  REMOVED: "border-transparent bg-red-100 text-red-800",
};

interface MembersTableProps {
  members: MemberRow[];
  currentUserId: string;
  currentUserRoles: Role[];
  onRefresh: () => void;
}

export function MembersTable({
  members,
  currentUserId,
  currentUserRoles,
  onRefresh,
}: MembersTableProps) {
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentUserRoles.includes("OWNER");
  const isAdmin = isOwner || currentUserRoles.includes("ADMIN");

  async function handleRoleChange(membershipId: string, roles: Role[]) {
    setError(null);
    setLoadingId(membershipId);
    try {
      const res = await fetch(`/api/team/members/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles }),
      });
      const data = (await res.json().catch(() => ({ error: "Unexpected error" }))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to update role");
        return;
      }
      onRefresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleRemove(membershipId: string) {
    setError(null);
    setLoadingId(membershipId);
    try {
      const res = await fetch(`/api/team/members/${membershipId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({ error: "Unexpected error" }))) as {
          error?: string;
        };
        setError(data.error ?? "Failed to remove member");
        return;
      }
      onRefresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingId(null);
      setConfirmRemoveId(null);
    }
  }

  const memberToRemove = members.find((m) => m.id === confirmRemoveId);

  return (
    <>
      {error && (
        <p className="text-sm text-destructive mb-3" role="alert">
          {error}
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Status</TableHead>
            {isAdmin && <TableHead className="w-12" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={isAdmin ? 5 : 4}
                className="text-center text-muted-foreground py-8"
              >
                No members found.
              </TableCell>
            </TableRow>
          )}
          {members.map((member) => {
            const isSelf = member.user.id === currentUserId;
            const targetIsOwner = member.roles.includes("OWNER");
            const canModify = isAdmin && (!targetIsOwner || isOwner) && !isSelf;

            return (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.user.name ?? "Unnamed user"}</TableCell>
                <TableCell className="text-muted-foreground">{member.user.email ?? "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {member.roles.map((role) => (
                      <RoleBadge key={role} role={role} />
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={STATUS_STYLES[member.status]}>
                    {member.status.charAt(0) + member.status.slice(1).toLowerCase()}
                  </Badge>
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    {canModify && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={loadingId === member.id}
                            aria-label="Member actions"
                          >
                            <MoreHorizontal aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Change role</DropdownMenuLabel>
                          {ASSIGNABLE_ROLES.filter(({ value }) =>
                            isOwner ? true : value !== "OWNER",
                          ).map(({ value, label }) => (
                            <DropdownMenuItem
                              key={value}
                              disabled={member.roles.includes(value) && member.roles.length === 1}
                              onSelect={() => handleRoleChange(member.id, [value])}
                            >
                              {label}
                              {member.roles.includes(value) && member.roles.length === 1 && (
                                <span className="ml-auto text-xs text-muted-foreground">
                                  Current
                                </span>
                              )}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setConfirmRemoveId(member.id)}
                          >
                            <Trash2 aria-hidden="true" />
                            Remove member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Remove confirmation dialog */}
      <Dialog
        open={confirmRemoveId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmRemoveId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <strong>
                {memberToRemove?.user.name ?? memberToRemove?.user.email ?? "this member"}
              </strong>{" "}
              from the church? They will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmRemoveId(null)}
              disabled={loadingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={loadingId !== null}
              onClick={() => {
                if (confirmRemoveId) handleRemove(confirmRemoveId);
              }}
            >
              {loadingId !== null ? "Removing..." : "Remove member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
