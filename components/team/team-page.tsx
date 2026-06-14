"use client";

import { Button } from "@/components/ui/button";
import type { Role } from "@prisma/client";
import { UserPlus } from "lucide-react";
import { useCallback, useState } from "react";
import { type InvitationRow, InvitationsTable } from "./invitations-table";
import { InviteMemberDialog } from "./invite-member-dialog";
import { type MemberRow, MembersTable } from "./members-table";

interface TeamPageProps {
  initialMembers: MemberRow[];
  initialInvitations: InvitationRow[];
  currentUserId: string;
  currentUserRoles: Role[];
  canInvite: boolean;
}

export function TeamPage({
  initialMembers,
  initialInvitations,
  currentUserId,
  currentUserRoles,
  canInvite,
}: TeamPageProps) {
  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [invitations, setInvitations] = useState<InvitationRow[]>(initialInvitations);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        fetch("/api/team/members"),
        fetch("/api/team/invitations/pending"),
      ]);
      if (membersRes.ok) {
        const data = (await membersRes.json()) as MemberRow[];
        setMembers(data);
      }
      if (invitationsRes.ok) {
        const data = (await invitationsRes.json()) as InvitationRow[];
        setInvitations(data);
      }
    } catch {
      // Ignore refresh errors — stale data is acceptable
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* Members section */}
      <section aria-labelledby="members-heading">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 id="members-heading" className="text-base font-semibold text-slate-800">
              Current members
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {members.length} {members.length === 1 ? "member" : "members"}
            </p>
          </div>
          {canInvite && (
            <Button onClick={() => setInviteOpen(true)} disabled={refreshing}>
              <UserPlus aria-hidden="true" />
              Invite member
            </Button>
          )}
        </div>

        <div className="rounded-md border bg-white">
          <MembersTable
            members={members}
            currentUserId={currentUserId}
            currentUserRoles={currentUserRoles}
            onRefresh={refresh}
          />
        </div>
      </section>

      {/* Invitations section */}
      {canInvite && (
        <section aria-labelledby="invitations-heading">
          <div className="mb-4">
            <h3 id="invitations-heading" className="text-base font-semibold text-slate-800">
              Pending invitations
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">{invitations.length} pending</p>
          </div>

          <div className="rounded-md border bg-white">
            <InvitationsTable invitations={invitations} onRefresh={refresh} />
          </div>
        </section>
      )}

      {canInvite && (
        <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} onSuccess={refresh} />
      )}
    </div>
  );
}
