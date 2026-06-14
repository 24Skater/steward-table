"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Role } from "@prisma/client";
import { useState } from "react";
import { RoleBadge } from "./role-badge";

export interface InvitationRow {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const absDiffSec = Math.abs(diffMs) / 1000;

  if (absDiffSec < 60) return diffMs < 0 ? "just now" : "in a moment";
  if (absDiffSec < 3600) {
    const mins = Math.round(absDiffSec / 60);
    return diffMs < 0 ? `${mins}m ago` : `in ${mins}m`;
  }
  if (absDiffSec < 86400) {
    const hours = Math.round(absDiffSec / 3600);
    return diffMs < 0 ? `${hours}h ago` : `in ${hours}h`;
  }
  const days = Math.round(absDiffSec / 86400);
  return diffMs < 0 ? `${days}d ago` : `in ${days}d`;
}

function isExpired(dateStr: string): boolean {
  return new Date(dateStr).getTime() < Date.now();
}

interface InvitationsTableProps {
  invitations: InvitationRow[];
  onRefresh: () => void;
}

export function InvitationsTable({ invitations, onRefresh }: InvitationsTableProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke(invitationId: string) {
    setError(null);
    setLoadingId(invitationId);
    try {
      const res = await fetch(`/api/team/invitations/${invitationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({ error: "Unexpected error" }))) as {
          error?: string;
        };
        setError(data.error ?? "Failed to revoke invitation");
        return;
      }
      onRefresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

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
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No pending invitations.
              </TableCell>
            </TableRow>
          )}
          {invitations.map((inv) => {
            const expired = isExpired(inv.expiresAt);
            return (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.email}</TableCell>
                <TableCell>
                  <RoleBadge role={inv.role} />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatRelativeTime(inv.createdAt)}
                </TableCell>
                <TableCell>
                  {expired ? (
                    <span className="text-sm font-medium text-red-600">Expired</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {formatRelativeTime(inv.expiresAt)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingId === inv.id}
                    onClick={() => handleRevoke(inv.id)}
                  >
                    {loadingId === inv.id ? "Revoking..." : "Revoke"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
