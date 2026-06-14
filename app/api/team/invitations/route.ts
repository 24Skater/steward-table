import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac/can";
import type { SessionMembership } from "@/lib/auth/types";
import type { Role } from "@prisma/client";
import { randomBytes } from "crypto";

const INVITABLE_ROLES: Role[] = ["ADMIN", "STAFF", "COOK", "DRIVER", "VIEWER"];
const INVITATION_TTL_DAYS = 7;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const membership = session.user.memberships?.find(
    (m: SessionMembership) => m.status === "ACTIVE",
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await can("member.invite", {
    userId: session.user.id,
    churchId: membership.churchId,
    roles: membership.roles,
  });
  if (!result.allowed) {
    return NextResponse.json({ error: result.reason ?? "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { email?: string; role?: Role } | null;
  if (!body?.email || typeof body.email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  if (!body.role || !INVITABLE_ROLES.includes(body.role)) {
    return NextResponse.json(
      { error: `role must be one of: ${INVITABLE_ROLES.join(", ")}` },
      { status: 400 },
    );
  }

  const emailLower = body.email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailLower)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Check if there's already an active membership for this email
  const existingUser = await (db.user.findUnique as PrismaBypass)({
    where: { email: emailLower },
    select: { id: true },
    _bypassTenancyCheck: true,
  });

  if (existingUser) {
    const existingMembership = await (db.membership.findFirst as PrismaBypass)({
      where: {
        userId: existingUser.id,
        churchId: membership.churchId,
        status: { in: ["ACTIVE", "SUSPENDED"] },
      },
      _bypassTenancyCheck: true,
    });
    if (existingMembership) {
      return NextResponse.json(
        { error: "This user already has an active membership" },
        { status: 409 },
      );
    }
  }

  // Check for a pending invitation for this email
  const pendingInvitation = await (db.invitation.findFirst as PrismaBypass)({
    where: {
      churchId: membership.churchId,
      email: emailLower,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    _bypassTenancyCheck: true,
  });
  if (pendingInvitation) {
    return NextResponse.json(
      { error: "A pending invitation already exists for this email" },
      { status: 409 },
    );
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const invitation = await (db.invitation.create as PrismaBypass)({
    data: {
      churchId: membership.churchId,
      email: emailLower,
      role: body.role,
      token,
      status: "PENDING",
      sentById: session.user.id,
      expiresAt,
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      expiresAt: true,
    },
    _bypassTenancyCheck: true,
  });

  // Attempt to send email via Resend — graceful degradation if not configured
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.stewardtable.com";
      const inviteUrl = `${appUrl}/auth/accept-invite?token=${token}`;

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? "noreply@stewardtable.com",
        to: emailLower,
        subject: "You have been invited to join Steward Table",
        html: `
          <p>You have been invited to join a church on Steward Table.</p>
          <p>Your role will be: <strong>${body.role}</strong></p>
          <p><a href="${inviteUrl}">Accept invitation</a></p>
          <p>This invitation expires in ${INVITATION_TTL_DAYS} days.</p>
        `,
      });
    }
  } catch {
    // Email send failure must not block the invitation creation response
  }

  return NextResponse.json(invitation, { status: 201 });
}
