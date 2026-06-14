import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

// All possible actions in the system
export type Action =
  | "church.update"
  | "church.delete"
  | "church.billing"
  | "member.invite"
  | "member.update"
  | "member.remove"
  | "catalog.read"
  | "catalog.edit"
  | "catalog.publish"
  | "inventory.read"
  | "inventory.adjust"
  | "customer.read"
  | "customer.edit"
  | "customer.export"
  | "order.read"
  | "order.create"
  | "order.update"
  | "order.kitchen"
  | "order.deliver"
  | "order.cancel"
  | "order.refund"
  | "payment.read"
  | "settings.payment"
  | "settings.tax"
  | "settings.receipt"
  | "settings.email"
  | "settings.branding"
  | "report.read"
  | "report.export"
  | "audit.read";

export interface CanContext {
  userId: string;
  churchId: string;
  roles: Role[];
  // Resource context for conditional checks
  targetMembershipId?: string;
  targetUserId?: string;
  orderId?: string;
  orderStatus?: string;
  orderCreatedAt?: Date;
  orderCreatedById?: string;
  catalogId?: string;
  catalogStatus?: string;
  driverId?: string;
  ip?: string;
  userAgent?: string;
}

export interface CanResult {
  allowed: boolean;
  reason?: string;
  // For conditional permissions, describes any restrictions that apply
  restrictions?: Record<string, unknown>;
}

// Admin-chain inheritance expansion
function expandRoles(roles: Role[]): Set<Role> {
  const expanded = new Set<Role>(roles);
  if (expanded.has("OWNER")) {
    expanded.add("ADMIN");
    expanded.add("STAFF");
  }
  if (expanded.has("ADMIN")) {
    expanded.add("STAFF");
  }
  return expanded;
}

async function writeDenyAuditLog(ctx: CanContext, action: Action, reason: string): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        churchId: ctx.churchId,
        actorId: ctx.userId,
        action,
        resource: action.split(".")[0] ?? action,
        metadata: { reason, roles: ctx.roles },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        _bypassTenancyCheck: true,
      } as Parameters<typeof db.auditLog.create>[0]["data"],
    });
  } catch {
    // Audit log failure must never block the deny response
  }
}

function deny(reason: string): CanResult {
  return { allowed: false, reason };
}

function allow(restrictions?: Record<string, unknown>): CanResult {
  return { allowed: true, restrictions };
}

/**
 * Core permission gate. Every API route and server action calls this at entry.
 * No ad-hoc role checks anywhere else in the codebase.
 */
export async function can(action: Action, ctx: CanContext): Promise<CanResult> {
  const effectiveRoles = expandRoles(ctx.roles);

  const result = await resolvePermission(action, ctx, effectiveRoles);

  if (!result.allowed) {
    await writeDenyAuditLog(ctx, action, result.reason ?? "denied");
  }

  return result;
}

async function resolvePermission(
  action: Action,
  ctx: CanContext,
  roles: Set<Role>,
): Promise<CanResult> {
  // OWNER and ADMIN inherit from each other per expansion — check unconditional grants first
  switch (action) {
    // ── Church ─────────────────────────────────────────────────────────
    case "church.update":
      if (roles.has("ADMIN")) return allow();
      return deny("Requires ADMIN or OWNER");

    case "church.delete":
    case "church.billing":
      if (roles.has("OWNER")) return allow();
      return deny("Requires OWNER");

    // ── Members ────────────────────────────────────────────────────────
    case "member.invite":
      if (roles.has("ADMIN")) return allow();
      return deny("Requires ADMIN or OWNER");

    case "member.update":
    case "member.remove": {
      if (roles.has("OWNER")) return allow();
      if (roles.has("ADMIN")) {
        // ADMIN cannot target an OWNER membership
        if (ctx.targetMembershipId) {
          const target = await db.membership.findFirst({
            where: {
              id: ctx.targetMembershipId,
              churchId: ctx.churchId,
            },
            _bypassTenancyCheck: true,
          } as Parameters<typeof db.membership.findFirst>[0]);
          if (target?.roles.includes("OWNER")) {
            return deny("ADMIN cannot modify an OWNER membership");
          }
        }
        return allow();
      }
      return deny("Requires ADMIN or OWNER");
    }

    // ── Catalog ────────────────────────────────────────────────────────
    case "catalog.read": {
      if (roles.has("STAFF") || roles.has("VIEWER")) return allow();
      if (roles.has("COOK")) {
        // COOK can only read OPEN catalogs
        if (ctx.catalogStatus && ctx.catalogStatus !== "OPEN") {
          return deny("COOK can only read catalogs with status OPEN");
        }
        return allow({ restriction: "OPEN catalogs only" });
      }
      return deny("Requires STAFF, ADMIN, OWNER, COOK, or VIEWER");
    }

    case "catalog.edit":
    case "catalog.publish":
      if (roles.has("ADMIN")) return allow();
      return deny("Requires ADMIN or OWNER");

    // ── Inventory ──────────────────────────────────────────────────────
    case "inventory.read":
      if (roles.has("STAFF") || roles.has("COOK")) return allow();
      return deny("Requires STAFF, ADMIN, OWNER, or COOK");

    case "inventory.adjust": {
      if (roles.has("ADMIN") || roles.has("COOK")) return allow();
      if (roles.has("STAFF")) {
        // STAFF can only adjust items in OPEN catalogs
        if (ctx.catalogStatus && ctx.catalogStatus !== "OPEN") {
          return deny("STAFF can only adjust inventory for items in OPEN catalogs");
        }
        return allow({ restriction: "OPEN catalogs only" });
      }
      return deny("Requires STAFF (OPEN catalogs only), ADMIN, OWNER, or COOK");
    }

    // ── Customers ──────────────────────────────────────────────────────
    case "customer.read": {
      if (roles.has("STAFF")) return allow();
      if (roles.has("DRIVER")) {
        // DRIVER can only read their assigned customers
        if (ctx.driverId && ctx.driverId !== ctx.userId) {
          return deny("DRIVER can only read customers assigned to them");
        }
        return allow({ restriction: "name, phone, address only" });
      }
      return deny("Requires STAFF, ADMIN, OWNER, or DRIVER (own deliveries only)");
    }

    case "customer.edit":
      if (roles.has("STAFF")) return allow();
      return deny("Requires STAFF, ADMIN, or OWNER");

    case "customer.export":
      if (roles.has("ADMIN")) return allow();
      return deny("Requires ADMIN or OWNER");

    // ── Orders ─────────────────────────────────────────────────────────
    case "order.read": {
      if (roles.has("STAFF")) return allow();
      if (roles.has("COOK")) {
        return allow({
          restriction: "status IN (CONFIRMED, IN_KITCHEN, READY), OPEN catalogs only",
        });
      }
      if (roles.has("DRIVER")) {
        return allow({ restriction: "own deliveries only" });
      }
      if (roles.has("VIEWER")) {
        return allow({
          restriction: "aggregated counts/totals only; no individual rows; no customer PII",
        });
      }
      return deny("Requires STAFF, ADMIN, OWNER, COOK, DRIVER, or VIEWER");
    }

    case "order.create":
    case "order.update":
      if (roles.has("STAFF")) return allow();
      return deny("Requires STAFF, ADMIN, or OWNER");

    case "order.kitchen":
      if (roles.has("COOK") || roles.has("STAFF")) return allow();
      return deny("Requires STAFF, ADMIN, OWNER, or COOK");

    case "order.deliver": {
      if (roles.has("ADMIN")) return allow();
      if (roles.has("DRIVER")) {
        if (ctx.driverId && ctx.driverId !== ctx.userId) {
          return deny("DRIVER can only deliver their own assigned orders");
        }
        return allow();
      }
      return deny("Requires ADMIN, OWNER, or DRIVER (own deliveries only)");
    }

    case "order.cancel": {
      if (roles.has("ADMIN")) return allow();
      if (roles.has("STAFF")) {
        const cancelableStatuses = new Set(["DRAFT", "SUBMITTED", "CONFIRMED"]);
        const statusOk = ctx.orderStatus !== undefined && cancelableStatuses.has(ctx.orderStatus);
        const withinHour =
          ctx.orderCreatedById === ctx.userId &&
          ctx.orderCreatedAt !== undefined &&
          Date.now() - ctx.orderCreatedAt.getTime() < 60 * 60 * 1000;
        if (statusOk || withinHour) return allow();
        return deny(
          "STAFF can only cancel orders in DRAFT/SUBMITTED/CONFIRMED status, or orders they created within the last hour",
        );
      }
      return deny("Requires STAFF (with conditions), ADMIN, or OWNER");
    }

    case "order.refund": {
      if (roles.has("ADMIN")) return allow();
      if (roles.has("STAFF")) {
        return allow({ restriction: "partial refunds only, up to staffRefundCapCents" });
      }
      return deny("Requires STAFF (partial, capped) or ADMIN/OWNER");
    }

    // ── Payments ───────────────────────────────────────────────────────
    case "payment.read":
      if (roles.has("STAFF")) return allow();
      return deny("Requires STAFF, ADMIN, or OWNER");

    // ── Settings ───────────────────────────────────────────────────────
    case "settings.payment":
    case "settings.tax":
    case "settings.receipt":
    case "settings.email":
    case "settings.branding":
      if (roles.has("ADMIN")) return allow();
      return deny("Requires ADMIN or OWNER");

    // ── Reports ────────────────────────────────────────────────────────
    case "report.read": {
      if (roles.has("ADMIN")) return allow();
      if (roles.has("STAFF")) {
        return allow({ restriction: "today's operational reports only" });
      }
      if (roles.has("VIEWER")) {
        return allow({ restriction: "aggregated reports only; no customer-level rows" });
      }
      return deny("Requires STAFF (today only), ADMIN, OWNER, or VIEWER (aggregated only)");
    }

    case "report.export":
      if (roles.has("ADMIN")) return allow();
      return deny("Requires ADMIN or OWNER");

    // ── Audit ──────────────────────────────────────────────────────────
    case "audit.read":
      if (roles.has("ADMIN")) return allow();
      return deny("Requires ADMIN or OWNER");

    default:
      return deny(`Unknown action: ${action}`);
  }
}
